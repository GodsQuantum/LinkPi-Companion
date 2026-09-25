<?php
require __DIR__ . '/lib.php';
require __DIR__ . '/companion.php';
require __DIR__ . '/studio.php';

define('AD_HARDWARE', AD_BASE . '/hardware.json');
define('AD_PUBLIC', AD_BASE . '/public');

function api_headers(string $type = 'application/json; charset=utf-8'): void {
    header('Content-Type: ' . $type);
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header("Content-Security-Policy: default-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'");
}

function send_json(int $status, $body): void {
    http_response_code($status);
    api_headers();
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    if (strlen($raw) > 16384) throw new RuntimeException('Request body too large');
    $body = json_decode($raw, true);
    if (!is_array($body)) throw new InvalidArgumentException('Invalid JSON body');
    return $body;
}
function current_state(): array {
    return load_json_file(AD_STATE, [
        'mode' => 'OFF', 'scene' => 'SPLIT',
        'editorialSettings' => load_editorial_settings(),
        'health' => ['rpc' => false, 'sceneControl' => true],
        'readiness' => ['autoReady' => false],
        'scores' => ['a' => null, 'b' => null],
        'lastDecision' => null,
        'telemetry' => ['volumes' => [], 'inputs' => [], 'system' => null, 'carousel' => null],
    ]);
}

function validate_hardware(array $h): array {
    $out = load_json_file(AD_HARDWARE, []);
    foreach (['a','b'] as $k) {
        $det = $h['detectors'][$k] ?? $out['detectors'][$k] ?? null;
        if (!is_array($det) || !is_int($det['channelId'] ?? null) || !in_array($det['side'] ?? '', ['L','R','max'], true))
            throw new InvalidArgumentException("Invalid detector {$k}");
        $out['detectors'][$k] = $det;
        $cal = $h['calibration'][$k] ?? $out['calibration'][$k] ?? null;
        if ($cal !== null && !valid_calibration($cal)) throw new InvalidArgumentException("Invalid calibration {$k}");
        $out['calibration'][$k] = $cal;
    }
    $video = $h['videoSources'] ?? $out['videoSources'] ?? [];
    if (!is_int($video['a'] ?? null) || !is_int($video['b'] ?? null)) throw new InvalidArgumentException('Invalid video sources');
    $out['videoSources'] = $video;
    $sceneMap = $h['sceneToLayId'] ?? $out['sceneToLayId'] ?? [];
    foreach (['CAM_A','CAM_B','SPLIT'] as $scene) {
        $value = $sceneMap[$scene] ?? null;
        if ($value !== null && !is_int($value)) throw new InvalidArgumentException("Invalid layout id {$scene}");
    }
    $out['sceneToLayId'] = $sceneMap;
    $requestedReady = ($h['scenesReady'] ?? $out['scenesReady'] ?? false) === true;
    $allMapped = !in_array(null, [$sceneMap['CAM_A'] ?? null, $sceneMap['CAM_B'] ?? null, $sceneMap['SPLIT'] ?? null], true);
    $out['scenesReady'] = $requestedReady && $allMapped;
    $key = $h['carouselSourceKey'] ?? $out['carouselSourceKey'] ?? 'source1';
    if (!is_string($key) || !preg_match('/^source[0-9]+$/', $key)) throw new InvalidArgumentException('Invalid carousel source key');
    $out['carouselSourceKey'] = $key;
    return $out;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

try {
    if ($method === 'GET' && $path === '/api/state') { send_json(200, current_state()); return; }
    if ($method === 'GET' && $path === '/api/companion/summary') { send_json(200, companion_summary(current_state())); return; }
    if ($method === 'GET' && $path === '/api/companion/channels') { send_json(200, companion_channels()); return; }
    if ($method === 'GET' && $path === '/api/companion/recording') { send_json(200, companion_recording()); return; }
    if ($method === 'GET' && $path === '/api/companion/streaming') { send_json(200, companion_streaming()); return; }
    if ($method === 'GET' && $path === '/api/studio/state') { send_json(200, studio_state()); return; }
    if ($method === 'PUT' && $path === '/api/studio/config') { send_json(200, studio_save_config(json_body())); return; }
    if ($method === 'POST' && $path === '/api/studio/stream/start') { send_json(200, studio_start_stream(json_body())); return; }
    if ($method === 'POST' && $path === '/api/studio/stream/stop') { send_json(200, studio_stop_stream()); return; }
    if ($method === 'POST' && $path === '/api/studio/record/start') { send_json(200, studio_start_record(json_body())); return; }
    if ($method === 'POST' && $path === '/api/studio/record/stop') { send_json(200, studio_stop_record()); return; }
    if ($method === 'POST' && $path === '/api/studio/storage/mount') {
        $b=json_body(); send_json(200, studio_mount_storage((string)($b['device']??''))); return;
    }
    if ($method === 'POST' && $path === '/api/studio/layout') {
        $b=json_body(); send_json(200, studio_apply_layout((int)($b['layoutId']??-1), is_array($b['audio']??null)?$b['audio']:[])); return;
    }
    if ($method === 'POST' && $path === '/api/studio/remoteobs/preview') { send_json(200, studio_remote_obs_preview(json_body())); return; }
    if ($method === 'POST' && $path === '/api/studio/autodirector/prepare') { send_json(200, studio_prepare_autodirector(json_body())); return; }
    if ($method === 'POST' && $path === '/api/studio/autodirector/calibrate') { send_json(200, studio_calibrate(json_body())); return; }
    if (preg_match('#^/api/studio/provider/([a-z0-9_-]+)$#',$path,$m) && $method === 'PUT') {
        send_json(200, studio_save_provider($m[1],json_body())); return;
    }
    if (preg_match('#^/api/studio/network/([1-4])$#',$path,$m) && $method === 'PUT') {
        $b=json_body(); $b['slot']=(int)$m[1]; send_json(200, studio_set_network_source($b)); return;
    }
    if (preg_match('#^/api/studio/network/([1-4])$#',$path,$m) && $method === 'DELETE') {
        send_json(200, studio_disable_network_source((int)$m[1])); return;
    }
    if ($method === 'GET' && $path === '/api/config/public') {
        $host = $_SERVER['HTTP_HOST'] ?? '192.168.1.217:8787';
        $baseHost = explode(':', $host)[0];
        send_json(200, ['nativeUiUrl' => 'http://' . $baseHost . '/', 'pollMs' => 250]); return;
    }
    if ($method === 'GET' && $path === '/api/settings') {
        send_json(200, ['settings' => load_editorial_settings(), 'presets' => editorial_presets(), 'limits' => editorial_limits()]); return;
    }
    if ($method === 'PUT' && $path === '/api/settings') {
        send_json(200, save_editorial_settings(json_body())); return;
    }
    if ($method === 'POST' && $path === '/api/settings/preset') {
        $body = json_body(); $name = strtoupper((string)($body['name'] ?? ''));
        $presets = editorial_presets();
        if (!isset($presets[$name])) throw new InvalidArgumentException('Unknown preset');
        send_json(200, save_editorial_settings($presets[$name])); return;
    }
    if ($method === 'GET' && $path === '/api/hardware') {
        send_json(200, load_json_file(AD_HARDWARE, [])); return;
    }
    if ($method === 'PUT' && $path === '/api/hardware') {
        $validated = validate_hardware(json_body());
        write_json_atomic(AD_HARDWARE, $validated);
        send_json(200, $validated); return;
    }
    if ($method === 'POST' && $path === '/api/mode') {
        $body = json_body(); $mode = strtoupper((string)($body['mode'] ?? ''));
        if (!in_array($mode, ['OFF','DRY_RUN','AUTO','SAFE_SPLIT','MANUAL'], true))
            throw new InvalidArgumentException('Unknown mode');
        $state = current_state();
        if ($mode === 'AUTO' && (($state['readiness']['autoReady'] ?? false) !== true)) {
            send_json(409, ['error' => 'AUTO blocked: readiness incomplete']); return;
        }
        if ($mode === 'SAFE_SPLIT' && (!(($state['readiness']['rpcReady'] ?? false)) || !(($state['readiness']['scenesReady'] ?? false)))) {
            send_json(409, ['error' => 'SAFE_SPLIT blocked: RPC or scenes unavailable']); return;
        }
        write_json_atomic(AD_CONTROL, ['mode' => $mode, 'requestedAt' => round(microtime(true) * 1000.0, 3)]);
        usleep(120000); send_json(200, current_state()); return;
    }
    $static = [
        '/' => ['index.html', 'text/html; charset=utf-8'],
        '/app.js' => ['app.js', 'text/javascript; charset=utf-8'],
        '/studio.js' => ['studio.js', 'text/javascript; charset=utf-8'],
        '/studio-i18n.js' => ['studio-i18n.js', 'text/javascript; charset=utf-8'],
        '/stream-builders.js' => ['stream-builders.js', 'text/javascript; charset=utf-8'],
        '/i18n.js' => ['i18n.js', 'text/javascript; charset=utf-8'],
        '/native-pages.js' => ['native-pages.js', 'text/javascript; charset=utf-8'],
        '/logo.svg' => ['logo.svg', 'image/svg+xml'],
        '/styles.css' => ['styles.css', 'text/css; charset=utf-8'],
    ];
    if (($method === 'GET' || $method === 'HEAD') && isset($static[$path])) {
        [$file, $type] = $static[$path];
        $full = AD_PUBLIC . '/' . $file;
        if (!is_file($full)) { send_json(404, ['error' => 'Not found']); return; }
        api_headers($type); header('Cache-Control: no-cache');
        if ($method === 'GET') readfile($full);
        return;
    }
    send_json(404, ['error' => 'Not found']);
} catch (Throwable $e) {
    send_json(400, ['error' => $e->getMessage()]);
}
