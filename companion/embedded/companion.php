<?php

function companion_native_json(string $path, $fallback = []) {
    $url = 'http://127.0.0.1/' . ltrim($path, '/');
    $ctx = stream_context_create(['http' => ['timeout' => 1.5, 'ignore_errors' => true]]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false || $raw === '') return $fallback;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function companion_secret_key(string $key): bool {
    return preg_match('/pass(word|wd)?|secret|token|(^|_)key$|streamkey|credential/i', $key) === 1;
}

function companion_sanitize($value, string $key = '') {
    if ($key !== '' && companion_secret_key($key)) return '[REDACTED]';
    if (!is_array($value)) return $value;
    $out = [];
    foreach ($value as $k => $v) {
        $out[$k] = companion_sanitize($v, is_string($k) ? $k : '');
    }
    return $out;
}

function companion_channel_summary(array $channel): array {
    $encv = is_array($channel['encv'] ?? null) ? $channel['encv'] : [];
    $enca = is_array($channel['enca'] ?? null) ? $channel['enca'] : [];
    $capture = is_array($channel['capture'] ?? null) ? $channel['capture'] : [];
    return [
        'id' => $channel['id'] ?? null,
        'name' => (string)($channel['name'] ?? ''),
        'type' => (string)($channel['type'] ?? ''),
        'enabled' => ($channel['enable'] ?? false) === true,
        'video' => [
            'codec' => $encv['codec'] ?? null, 'width' => $encv['width'] ?? null,
            'height' => $encv['height'] ?? null, 'framerate' => $encv['framerate'] ?? null,
            'bitrate' => $encv['bitrate'] ?? null, 'rcmode' => $encv['rcmode'] ?? null,
        ],
        'audio' => [
            'source' => $enca['audioSrc'] ?? null, 'codec' => $enca['codec'] ?? null,
            'samplerate' => $enca['samplerate'] ?? null, 'bitrate' => $enca['bitrate'] ?? null,
            'channels' => $enca['channels'] ?? null,
        ],
        'capture' => companion_sanitize($capture),
    ];
}

function companion_channels(): array {
    $config = companion_native_json('config/config.json', []);
    $out = [];
    foreach ($config as $channel) {
        if (is_array($channel)) $out[] = companion_channel_summary($channel);
    }
    return ['channels' => $out];
}

function companion_recording(): array {
    $record = companion_native_json('config/record.json', []);
    $disk = companion_native_json('config/misc/disk.json', []);
    $format = is_array($record['format'] ?? null) ? $record['format'] : [];
    $fragment = is_array($record['fragment'] ?? null) ? $record['fragment'] : [];
    $used = (string)($disk['used'] ?? '');
    $localDevice = (string)($disk['local']['device'] ?? '');
    $looksExternal = $used !== '' && $used !== 'local';
    if ($used === 'local' && $localDevice !== '' && !str_starts_with($localDevice, '/dev/mmcblk')) $looksExternal = true;
    return [
        'auto' => ($record['auto'] ?? false) === true,
        'channels' => array_values(array_filter($record['chns'] ?? [], 'is_int')),
        'format' => companion_sanitize($format),
        'fragment' => companion_sanitize($fragment),
        'limit' => $record['limit'] ?? null,
        'disk' => [
            'enabled' => ($disk['enable'] ?? false) === true,
            'used' => $used,
            'externalConfigured' => $looksExternal,
            'localDevice' => $localDevice,
            'sharedType' => $disk['shared']['type'] ?? null,
            'sharedPathConfigured' => !empty($disk['shared']['path']),
        ],
    ];
}

function companion_streaming_from_config(array $push): array {
    $destinations = [];
    foreach (($push['url'] ?? []) as $item) {
        if (!is_array($item)) continue;
        $path = (string)($item['path'] ?? '');
        $protocol = strtolower((string)parse_url($path, PHP_URL_SCHEME));
        $destinations[] = [
            'description' => (string)($item['des'] ?? ''),
            'enabled' => ($item['enable'] ?? false) === true,
            'stream' => (string)($item['stream'] ?? 'main'),
            'type' => (string)($item['type'] ?? 'normal'),
            'videoSource' => $item['srcV'] ?? null,
            'audioSource' => $item['srcA'] ?? null,
            'protocol' => $protocol,
        ];
    }
    return ['autorun' => ($push['autorun'] ?? false) === true, 'destinations' => $destinations];
}

function companion_streaming(): array {
    return companion_streaming_from_config(companion_native_json('config/push.json', []));
}

function companion_summary(array $state): array {
    $recording = companion_recording();
    $streaming = companion_streaming();
    $inputs = $state['telemetry']['inputs'] ?? [];
    $available = 0;
    foreach ($inputs as $input) {
        if (is_array($input) && ($input['avalible'] ?? false) === true) $available++;
    }
    return [
        'rpc' => ($state['health']['rpc'] ?? false) === true,
        'mode' => (string)($state['mode'] ?? 'OFF'),
        'scene' => (string)($state['scene'] ?? 'SPLIT'),
        'autoReady' => ($state['readiness']['autoReady'] ?? false) === true,
        'readiness' => companion_sanitize($state['readiness'] ?? []),
        'availableInputs' => $available,
        'inputCount' => is_array($inputs) ? count($inputs) : 0,
        'system' => companion_sanitize($state['telemetry']['system'] ?? []),
        'recording' => [
            'mp4' => ($recording['format']['mp4'] ?? false) === true,
            'channelCount' => count($recording['channels']),
            'externalStorageConfigured' => ($recording['disk']['externalConfigured'] ?? false) === true,
        ],
        'streaming' => [
            'destinationCount' => count($streaming['destinations']),
            'enabledDestinationCount' => count(array_filter($streaming['destinations'], fn($d) => ($d['enabled'] ?? false) === true)),
        ],
    ];
}
