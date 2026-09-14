<?php
require __DIR__ . '/lib.php';

define('AD_HARDWARE', AD_BASE . '/hardware.json');

define('AD_WORKER_PID', '/tmp/autodirector-worker.pid');

function load_hardware(): array {
    return load_json_file(AD_HARDWARE, []);
}

function load_control(): array {
    return load_json_file(AD_CONTROL, ['mode' => 'OFF']);
}

function carousel_current_scene(array $state, array $hardware): string {
    if (($state['hadCarousel'] ?? false) !== true) throw new RuntimeException('Carousel is not running');
    if (($state['activeMode'] ?? '') !== 'layout') throw new RuntimeException('Carousel mode is not layout');
    $key = $hardware['carouselSourceKey'] ?? 'source1';
    $items = $state['source'][$key] ?? null;
    if (!is_array($items) || !$items) throw new RuntimeException('Carousel source unavailable');
    $current = null;
    foreach ($items as $item) if ((float)($item['playTime'] ?? 0) > 0) { $current = $item; break; }
    if (!$current) throw new RuntimeException('Carousel current scene unknown');
    foreach (($hardware['sceneToLayId'] ?? []) as $scene => $layId)
        if ((string)$layId === (string)($current['layId'] ?? '')) return $scene;
    throw new RuntimeException('Unmanaged Carousel layout');
}
function apply_carousel_scene(string $scene, array $hardware): string {
    $order = ['CAM_A', 'CAM_B', 'SPLIT'];
    if (!in_array($scene, $order, true)) throw new InvalidArgumentException('Unknown scene');
    $before = linkpi_rpc_call('carousel.getState');
    $current = carousel_current_scene($before, $hardware);
    $from = array_search($current, $order, true);
    $to = array_search($scene, $order, true);
    $steps = ($to - $from + count($order)) % count($order);
    $sourceKey = $hardware['carouselSourceKey'] ?? 'source1';
    for ($i = 0; $i < $steps; $i++) linkpi_rpc_call('carousel.carouselTimeout', [$sourceKey]);
    $after = linkpi_rpc_call('carousel.getState');
    $actual = carousel_current_scene($after, $hardware);
    if ($actual !== $scene) throw new RuntimeException("Carousel verify failed: {$scene} != {$actual}");
    return $actual;
}

function state_payload(string $mode, array $core, array $settings, array $health,
    array $readiness, array $scores, ?array $lastDecision, array $telemetry): array {
    return [
        'mode' => $mode, 'scene' => $core['scene'],
        'editorialSettings' => $settings, 'health' => $health,
        'readiness' => $readiness, 'scores' => $scores,
        'lastDecision' => $lastDecision, 'telemetry' => $telemetry,
        'worker' => ['pid' => getmypid(), 'updatedAt' => round(microtime(true) * 1000.0, 3)],
    ];
}
file_put_contents(AD_WORKER_PID, (string)getmypid());
$core = new_autodirector_state();
$mode = 'OFF';
$health = ['rpc' => false, 'sceneControl' => true, 'lastError' => null, 'lastOkAt' => null];
$telemetry = ['volumes' => [], 'inputs' => [], 'system' => null, 'carousel' => null];
$scores = ['a' => null, 'b' => null];
$lastDecision = null;
$nextSlowPollAt = 0;

while (true) {
    $loopStarted = microtime(true);
    $now = round($loopStarted * 1000.0, 3);
    $settings = load_editorial_settings();
    $hardware = load_hardware();
    $requestedMode = strtoupper((string)(load_control()['mode'] ?? 'OFF'));
    if (!in_array($requestedMode, ['OFF','DRY_RUN','AUTO','SAFE_SPLIT','MANUAL'], true)) $requestedMode = 'OFF';
    $mode = $requestedMode;

    try {
        $telemetry['volumes'] = linkpi_rpc_call('enc.getVolume');
        if ($now >= $nextSlowPollAt) {
            $telemetry['inputs'] = linkpi_rpc_call('enc.getInputState');
            $telemetry['system'] = linkpi_rpc_call('enc.getSysState');
            $telemetry['carousel'] = linkpi_rpc_call('carousel.getState');
            $nextSlowPollAt = $now + 1000;
        }
        $health['rpc'] = true;
        $health['lastError'] = null;
        $health['lastOkAt'] = $now;
    } catch (Throwable $e) {
        $health['rpc'] = false;
        $health['lastError'] = $e->getMessage();
    }

    $scores = [
        'a' => detector_score($telemetry['volumes'], $hardware['detectors']['a'] ?? null, $hardware['calibration']['a'] ?? null),
        'b' => detector_score($telemetry['volumes'], $hardware['detectors']['b'] ?? null, $hardware['calibration']['b'] ?? null),
    ];
    $readiness = compute_readiness($health['rpc'], $health['sceneControl'],
        $telemetry['volumes'], $telemetry['inputs'], $hardware);

    if ($mode === 'AUTO' && !$readiness['autoReady']) {
        $mode = ($readiness['rpcReady'] && $readiness['scenesReady']) ? 'SAFE_SPLIT' : 'OFF';
        write_json_atomic(AD_CONTROL, ['mode' => $mode, 'reason' => 'AUTO safety demotion']);
    }
    if ($mode === 'SAFE_SPLIT' && $readiness['rpcReady'] && $readiness['scenesReady']) {
        try { apply_carousel_scene('SPLIT', $hardware); }
        catch (Throwable $e) { $health['sceneControl'] = false; $health['lastError'] = $e->getMessage(); }
    }

    if (in_array($mode, ['DRY_RUN','AUTO'], true) && $scores['a'] !== null && $scores['b'] !== null) {
        $lastDecision = autodirector_step($core, $settings, $now, $scores['a'], $scores['b']);
        if ($mode === 'AUTO' && ($lastDecision['changed'] ?? false)) {
            try { apply_carousel_scene($lastDecision['scene'], $hardware); }
            catch (Throwable $e) {
                $health['sceneControl'] = false; $health['lastError'] = $e->getMessage();
                $mode = 'SAFE_SPLIT'; write_json_atomic(AD_CONTROL, ['mode' => 'SAFE_SPLIT', 'reason' => 'scene failure']);
            }
        }
    }
    $readiness = compute_readiness($health['rpc'], $health['sceneControl'],
        $telemetry['volumes'], $telemetry['inputs'], $hardware);
    $payload = state_payload($mode, $core, $settings, $health, $readiness, $scores, $lastDecision, $telemetry);
    try { write_json_atomic(AD_STATE, $payload); }
    catch (Throwable $e) { error_log('AutoDirector state write: ' . $e->getMessage()); }

    $elapsedUs = (int)((microtime(true) - $loopStarted) * 1000000);
    $sleepUs = max(1000, 100000 - $elapsedUs);
    usleep($sleepUs);
}
