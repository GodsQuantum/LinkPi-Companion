<?php
require __DIR__ . '/lib.php';
require __DIR__ . '/companion.php';

function check($condition, $message) {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$presets = editorial_presets();
check($presets['NATURAL']['acquisitionMs'] === 900, 'natural acquisition');
check($presets['STABLE']['minShotMs'] > $presets['NATURAL']['minShotMs'], 'stable slower');
check($presets['REACTIVE']['refractoryMs'] < $presets['NATURAL']['refractoryMs'], 'reactive faster');
$valid = validate_editorial_settings($presets['NATURAL']);
check($valid['speechThresholdA'] === 0.35, 'threshold A');
$rejected = false;
try { validate_editorial_settings(array_merge($valid, ['refractoryMs' => 100])); }
catch (Throwable $e) { $rejected = true; }
check($rejected, 'unsafe refractory rejected');

echo "PASS settings\n";

function feed_core(&$state, $settings, $from, $to, $step, $a, $b) {
    $result = null;
    for ($now = $from; $now <= $to; $now += $step)
        $result = autodirector_step($state, $settings, $now, $a, $b);
    return $result;
}
$settings = editorial_presets()['NATURAL'];
$state = new_autodirector_state();
feed_core($state, $settings, 0, 800, 100, 0.9, 0.05);
check($state['scene'] === 'SPLIT', 'hold split during acquisition');
$r = autodirector_step($state, $settings, 900, 0.9, 0.05);
check($r['scene'] === 'CAM_A' && $r['changed'] === true, 'acquire camera A');

feed_core($state, $settings, 1000, 5800, 100, 0.05, 0.9);
check($state['scene'] === 'CAM_A', 'respect minimum shot');
$r = autodirector_step($state, $settings, 5900, 0.05, 0.9);
check($r['scene'] === 'CAM_B', 'handoff to camera B');

feed_core($state, $settings, 6000, 10900, 100, 0.05, 0.9);
feed_core($state, $settings, 11000, 11900, 100, 0.8, 0.8);
check($state['scene'] === 'CAM_B', 'overlap pending');
$r = autodirector_step($state, $settings, 12000, 0.8, 0.8);
check($r['scene'] === 'SPLIT' && $r['reason'] === 'sustained-overlap', 'overlap to split');

echo "PASS director-core\n";
$sys = linkpi_rpc_call('enc.getSysState');
check(is_array($sys) && array_key_exists('cpu', $sys), 'local RPC sys state');
$settingsExisted = is_file(AD_SETTINGS);
$settingsBackup = $settingsExisted ? file_get_contents(AD_SETTINGS) : null;
try {
    $loaded = save_editorial_settings(editorial_presets()['NATURAL']);
    check($loaded['acquisitionMs'] === 900, 'settings persistence write');
    $loaded = load_editorial_settings();
    check($loaded['refractoryMs'] === 2500, 'settings persistence read');
} finally {
    if ($settingsExisted) file_put_contents(AD_SETTINGS, $settingsBackup, LOCK_EX);
    else @unlink(AD_SETTINGS);
}

echo "PASS local-rpc-and-persistence\n";
$volumes = [['L' => 90, 'R' => 2], ['L' => 5, 'R' => 85]];
$hardware = [
    'detectors' => [
        'a' => ['channelId' => 0, 'side' => 'L'],
        'b' => ['channelId' => 1, 'side' => 'R'],
    ],
    'calibration' => [
        'a' => ['noiseFloor' => 10, 'speechReference' => 90],
        'b' => ['noiseFloor' => 5, 'speechReference' => 85],
    ],
    'videoSources' => ['a' => 0, 'b' => 1],
    'scenesReady' => true,
    'sceneToLayId' => ['CAM_A' => 101, 'CAM_B' => 102, 'SPLIT' => 103],
];
$inputs = [['chnId' => 0, 'avalible' => true], ['chnId' => 1, 'avalible' => true]];
check(abs(detector_score($volumes, $hardware['detectors']['a'], $hardware['calibration']['a']) - 1.0) < 0.001, 'score A normalized');
$ready = compute_readiness(true, true, $volumes, $inputs, $hardware);
check($ready['autoReady'] === true, 'synthetic AUTO readiness');
$ready = compute_readiness(true, true, [], [], $hardware);
check($ready['autoReady'] === false, 'missing telemetry blocks AUTO');

echo "PASS readiness\n";$largeNow = 1757868600000.0;
$largeState = new_autodirector_state();
feed_core($largeState, $settings, $largeNow, $largeNow + 800, 100, 0.9, 0.05);
$r = autodirector_step($largeState, $settings, $largeNow + 900, 0.9, 0.05);
check($r['scene'] === 'CAM_A', 'large millisecond timestamps remain safe on 32-bit PHP');
echo "PASS timestamp-32bit-safety\n";

$san = companion_sanitize(['user' => 'demo', 'passwd' => 'secret', 'nested' => ['token' => 'abc', 'bitrate' => 4000]]);
check($san['passwd'] === '[REDACTED]', 'companion password redacted');
check($san['nested']['token'] === '[REDACTED]', 'companion token redacted');
check($san['nested']['bitrate'] === 4000, 'companion non-secret preserved');
$push = ['autorun' => false, 'url' => [['des' => 'Platform', 'enable' => true, 'path' => 'rtmps://host/live/REAL_KEY', 'stream' => 'main', 'srcV' => 0, 'srcA' => 0]]];
$tmp = companion_streaming_from_config($push);
check(strpos(json_encode($tmp), 'REAL_KEY') === false, 'companion streaming path redacted');
echo "PASS companion-sanitization\n";
