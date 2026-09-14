<?php

define('AD_BASE', '/link/config/autodirector');
define('AD_SETTINGS', AD_BASE . '/settings.json');
define('AD_STATE', '/tmp/autodirector-state.json');
define('AD_CONTROL', '/tmp/autodirector-control.json');

function editorial_limits(): array {
    return [
        'acquisitionMs' => [200, 3000],
        'minShotMs' => [1500, 30000],
        'refractoryMs' => [500, 10000],
        'overlapMs' => [300, 5000],
        'splitHoldMs' => [1000, 15000],
        'silenceMs' => [2000, 60000],
        'speechThresholdA' => [0.05, 0.95],
        'speechThresholdB' => [0.05, 0.95],
        'dominanceMargin' => [0.02, 0.8],
    ];
}

function editorial_presets(): array {
    $natural = [
        'acquisitionMs' => 900, 'minShotMs' => 5000,
        'refractoryMs' => 2500, 'overlapMs' => 1000,
        'splitHoldMs' => 3000, 'silenceMs' => 7000,
        'speechThresholdA' => 0.35, 'speechThresholdB' => 0.35,
        'dominanceMargin' => 0.15,
    ];    return [
        'STABLE' => [
            'acquisitionMs' => 1200, 'minShotMs' => 7000,
            'refractoryMs' => 3500, 'overlapMs' => 1200,
            'splitHoldMs' => 4500, 'silenceMs' => 9000,
            'speechThresholdA' => 0.40, 'speechThresholdB' => 0.40,
            'dominanceMargin' => 0.20,
        ],
        'NATURAL' => $natural,
        'REACTIVE' => [
            'acquisitionMs' => 600, 'minShotMs' => 3500,
            'refractoryMs' => 1500, 'overlapMs' => 700,
            'splitHoldMs' => 2000, 'silenceMs' => 5000,
            'speechThresholdA' => 0.30, 'speechThresholdB' => 0.30,
            'dominanceMargin' => 0.10,
        ],
    ];
}

function validate_editorial_settings(array $candidate): array {
    $out = [];
    foreach (editorial_limits() as $key => [$min, $max]) {
        if (!array_key_exists($key, $candidate) || !is_numeric($candidate[$key]))
            throw new InvalidArgumentException("{$key} missing or non numeric");
        $value = (float)$candidate[$key];
        if ($value < $min || $value > $max)
            throw new InvalidArgumentException("{$key} must be between {$min} and {$max}");
        $out[$key] = str_ends_with($key, 'Ms') ? (int)$value : $value;
    }
    return $out;
}
function new_autodirector_state(): array {
    return [
        'scene' => 'SPLIT', 'sceneSince' => 0,
        'lastCutAt' => -PHP_INT_MAX,
        'candidate' => null, 'candidateSince' => null,
        'overlapSince' => null, 'silenceSince' => null,
        'splitHoldUntil' => 0,
    ];
}

function ad_result(array $state, bool $changed, string $reason): array {
    return [
        'scene' => $state['scene'], 'changed' => $changed,
        'reason' => $reason, 'candidate' => $state['candidate'],
    ];
}

function ad_clear_candidate(array &$state): void {
    $state['candidate'] = null;
    $state['candidateSince'] = null;
}

function ad_can_cut(array $state, array $cfg, float $now): bool {
    if ($now - $state['lastCutAt'] < $cfg['refractoryMs']) return false;
    if ($state['scene'] === 'SPLIT' && $now < $state['splitHoldUntil']) return false;
    if ($state['scene'] !== 'SPLIT' && $now - $state['sceneSince'] < $cfg['minShotMs']) return false;
    return true;
}
function ad_cut(array &$state, array $cfg, string $scene, float $now, string $reason): array {
    if ($scene === 'SPLIT' && $reason === 'sustained-overlap')
        $state['splitHoldUntil'] = $now + $cfg['splitHoldMs'];
    elseif ($scene !== 'SPLIT')
        $state['splitHoldUntil'] = 0;

    $state['scene'] = $scene;
    $state['sceneSince'] = $now;
    $state['lastCutAt'] = $now;
    ad_clear_candidate($state);
    return ad_result($state, true, $reason);
}

function ad_single_target(array $cfg, float $a, float $b): ?string {
    if ($a >= $cfg['speechThresholdA'] && $a - $b >= $cfg['dominanceMargin'])
        return 'CAM_A';
    if ($b >= $cfg['speechThresholdB'] && $b - $a >= $cfg['dominanceMargin'])
        return 'CAM_B';
    return null;
}

function autodirector_step(array &$state, array $cfg, float $now, float $a, float $b): array {
    $bothActive = $a >= $cfg['speechThresholdA'] && $b >= $cfg['speechThresholdB'];
    if ($bothActive) {
        ad_clear_candidate($state);
        if ($state['overlapSince'] === null) $state['overlapSince'] = $now;
        if ($state['scene'] === 'SPLIT') return ad_result($state, false, 'overlap-split');
        if ($now - $state['overlapSince'] < $cfg['overlapMs'])
            return ad_result($state, false, 'overlap-pending');        if (!ad_can_cut($state, $cfg, $now)) return ad_result($state, false, 'hold-min-shot');
        return ad_cut($state, $cfg, 'SPLIT', $now, 'sustained-overlap');
    }

    $state['overlapSince'] = null;
    $bothQuiet = $a < $cfg['speechThresholdA'] && $b < $cfg['speechThresholdB'];
    if ($bothQuiet) {
        ad_clear_candidate($state);
        if ($state['silenceSince'] === null) $state['silenceSince'] = $now;
        if ($state['scene'] !== 'SPLIT' &&
            $now - $state['silenceSince'] >= $cfg['silenceMs'] && ad_can_cut($state, $cfg, $now))
            return ad_cut($state, $cfg, 'SPLIT', $now, 'long-silence');
        return ad_result($state, false, 'silence-hold');
    }

    $state['silenceSince'] = null;
    $target = ad_single_target($cfg, $a, $b);
    if ($target === null || $target === $state['scene']) {
        ad_clear_candidate($state);
        return ad_result($state, false, 'hold');
    }
    if ($state['candidate'] !== $target) {
        $state['candidate'] = $target;
        $state['candidateSince'] = $now;
    }
    if ($now - $state['candidateSince'] < $cfg['acquisitionMs'])
        return ad_result($state, false, 'acquiring');    if (!ad_can_cut($state, $cfg, $now))
        return ad_result($state, false, 'hold-min-shot');
    return ad_cut($state, $cfg, $target, $now, 'speaker-acquired');
}

function write_json_atomic(string $path, array $data): void {
    $tmp = $path . '.tmp';
    $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false)
        throw new RuntimeException("Cannot write {$path}");
    if (!rename($tmp, $path))
        throw new RuntimeException("Cannot replace {$path}");
}

function load_json_file(string $path, array $fallback = []): array {
    if (!is_file($path)) return $fallback;
    $decoded = json_decode((string)file_get_contents($path), true);
    return is_array($decoded) ? $decoded : $fallback;
}

function save_editorial_settings(array $settings): array {
    $validated = validate_editorial_settings($settings);
    write_json_atomic(AD_SETTINGS, $validated);
    return $validated;
}

function load_editorial_settings(): array {
    $natural = editorial_presets()['NATURAL'];
    $stored = load_json_file(AD_SETTINGS, $natural);
    try { return validate_editorial_settings($stored); }
    catch (Throwable $e) { return $natural; }
}
function linkpi_rpc_call(string $method, array $params = []) {
    static $id = 1;
    $payload = json_encode([
        'jsonrpc' => '2.0', 'method' => $method,
        'params' => $params, 'id' => $id++,
    ], JSON_UNESCAPED_SLASHES);
    $errno = 0; $errstr = '';
    $fp = @fsockopen('127.0.0.1', 80, $errno, $errstr, 1.0);
    if (!$fp) throw new RuntimeException("RPC connect failed: {$errstr}");
    stream_set_timeout($fp, 1);
    $request = "POST /RPC HTTP/1.1\r\n" .
        "Host: 127.0.0.1\r\n" .
        "Content-Type: application/json\r\n" .
        "Content-Length: " . strlen($payload) . "\r\n" .
        "Connection: close\r\n\r\n" . $payload;
    fwrite($fp, $request);
    $response = stream_get_contents($fp);
    fclose($fp);
    $parts = explode("\r\n\r\n", $response, 2);
    if (count($parts) !== 2 || !preg_match('/^HTTP\/1\.[01] 200 /', $parts[0]))
        throw new RuntimeException("RPC HTTP failure");
    $decoded = json_decode($parts[1], true);
    if (!is_array($decoded)) throw new RuntimeException('RPC invalid JSON');
    if (isset($decoded['error']))
        throw new RuntimeException('RPC error: ' . json_encode($decoded['error']));
    return $decoded['result'] ?? null;
}
function valid_calibration(?array $item): bool {
    return is_array($item) && is_numeric($item['noiseFloor'] ?? null) &&
        is_numeric($item['speechReference'] ?? null) &&
        (float)$item['speechReference'] > (float)$item['noiseFloor'];
}

function detector_score(array $volumes, ?array $detector, ?array $calibration): ?float {
    if (!is_array($detector) || !valid_calibration($calibration)) return null;
    $channelId = $detector['channelId'] ?? null;
    if (!is_int($channelId) || !isset($volumes[$channelId]) || !is_array($volumes[$channelId])) return null;
    $meter = $volumes[$channelId];
    $side = $detector['side'] ?? 'L';
    if ($side === 'max') {
        if (!is_numeric($meter['L'] ?? null) || !is_numeric($meter['R'] ?? null)) return null;
        $raw = max((float)$meter['L'], (float)$meter['R']);
    } else {
        if (!is_numeric($meter[$side] ?? null)) return null;
        $raw = (float)$meter[$side];
    }
    $low = (float)$calibration['noiseFloor'];
    $high = (float)$calibration['speechReference'];
    return max(0.0, min(1.0, ($raw - $low) / ($high - $low)));
}
function compute_readiness(bool $rpcReady, bool $sceneControl, array $volumes, array $inputs, array $hardware): array {
    $detectorsConfigured = is_array($hardware['detectors']['a'] ?? null) && is_array($hardware['detectors']['b'] ?? null);
    $calibrationReady = valid_calibration($hardware['calibration']['a'] ?? null) &&
        valid_calibration($hardware['calibration']['b'] ?? null);
    $detectorsReady = $detectorsConfigured &&
        detector_score($volumes, $hardware['detectors']['a'], $hardware['calibration']['a'] ?? null) !== null &&
        detector_score($volumes, $hardware['detectors']['b'], $hardware['calibration']['b'] ?? null) !== null;
    $videoIds = [$hardware['videoSources']['a'] ?? null, $hardware['videoSources']['b'] ?? null];
    $videoReady = count(array_filter($videoIds, 'is_int')) === 2;
    if ($videoReady) {
        foreach ($videoIds as $id) {
            $found = false;
            foreach ($inputs as $input) {
                if (($input['chnId'] ?? null) === $id && ($input['avalible'] ?? false) === true) { $found = true; break; }
            }
            if (!$found) { $videoReady = false; break; }
        }
    }
    $scenesReady = ($hardware['scenesReady'] ?? false) === true;
    $autoReady = $rpcReady && $sceneControl && $detectorsReady && $calibrationReady && $videoReady && $scenesReady;
    return compact('rpcReady','detectorsConfigured','detectorsReady','calibrationReady','videoReady','scenesReady','autoReady');
}
