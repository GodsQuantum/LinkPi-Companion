<?php
define('STUDIO_CONFIG', AD_BASE . '/studio.json');
define('STUDIO_PROVIDERS', AD_BASE . '/providers.json');

function studio_resolutions(): array {
    return [
        '-1x-1'=>'Auto / source',
        '3840x2160'=>'4K UHD',
        '1920x1080'=>'1080p',
        '1280x720'=>'720p',
        '640x360'=>'360p',
        '1080x1920'=>'1080x1920 portrait',
        '720x1280'=>'720x1280 portrait',
        '360x640'=>'360x640 portrait',
    ];
}
function studio_fps_values(): array { return [60,50,30,25,24]; }
function studio_defaults(): array {
    return [
        'source'=>'AUTO',
        'record'=>['resolution'=>'-1x-1','fps'=>30,'codec'=>'h265','bitrate'=>16000,'rcmode'=>'vbr'],
        'live'=>['resolution'=>'1920x1080','fps'=>30,'codec'=>'auto','bitrate'=>5000,'autoBitrate'=>true,'rcmode'=>'cbr'],
        'recordSources'=>['ALL'],'programAudio'=>[0,1],'recordFragmentSeconds'=>1800,
    ];
}
function studio_provider_defaults(): array {
    return [
        'youtube'=>[
            'label'=>'YouTube','mode'=>'rtmps','server'=>'','streamKey'=>'',
            'enabled'=>false,'codec'=>'h265',
            'note'=>'RTMPS + HEVC supported. Copy the current RTMPS URL and key from YouTube Live Control Room.',
        ],
        'twitch'=>[
            'label'=>'Twitch','mode'=>'rtmp','server'=>'rtmp://live.twitch.tv/app','streamKey'=>'',
            'enabled'=>false,'codec'=>'h264',
            'note'=>'Direct hardware RTMP uses H.264. Twitch HEVC needs Enhanced Broadcasting, not exposed by LinkPi.',
        ],
        'restream'=>[
            'label'=>'Restream','mode'=>'srt','server'=>'','streamKey'=>'','srtUrl'=>'',
            'enabled'=>false,'codec'=>'h265',
            'note'=>'Preferred on Wi-Fi: SRT + HEVC. Restream transcodes HEVC to H.264 for destinations that need it.',
        ],
        'remoteobs'=>[
            'label'=>'Remote OBS','mode'=>'srt','remoteMode'=>'direct',
            'remoteHost'=>'','remotePort'=>9001,'latency'=>120,'passphrase'=>'',
            'srtUrl'=>'','obsUrl'=>'','relayPublishUrl'=>'','relayReadUrl'=>'','relayWebUrl'=>'',
            'enabled'=>false,'codec'=>'h265',
            'note'=>'SRT contribution feed for another OBS. Direct mode needs one UDP port; relay mode avoids inbound NAT.',
        ],
    ];
}
function studio_merge_known(array $base, array $stored): array {
    foreach ($stored as $k=>$v) if (array_key_exists($k,$base))
        $base[$k] = (is_array($base[$k]) && is_array($v)) ? studio_merge_known($base[$k],$v) : $v;
    return $base;
}
function studio_load_config(): array { return studio_merge_known(studio_defaults(), load_json_file(STUDIO_CONFIG, [])); }
function studio_validate_quality(array $q, array $fallback): array {
    $out=$fallback;
    if (isset($q['resolution'])) {
        $res=(string)$q['resolution'];
        if (!isset(studio_resolutions()[$res])) throw new InvalidArgumentException('Unsupported resolution');
        $out['resolution']=$res;
    }
    if (isset($q['fps'])) {
        $fps=(int)$q['fps'];
        if (!in_array($fps,studio_fps_values(),true)) throw new InvalidArgumentException('Unsupported frame rate');
        $out['fps']=$fps;
    }
    if (($out['resolution']??'')==='3840x2160' && (int)$out['fps']>30)
        throw new InvalidArgumentException('ENC1 V3 supports 4K up to 30 fps');
    if (isset($q['codec'])) {
        $codec=strtolower((string)$q['codec']);
        if (!in_array($codec,['auto','h264','h265'],true)) throw new InvalidArgumentException('Unsupported codec');
        $out['codec']=$codec;
    }
    if (isset($q['bitrate'])) {
        $br=(int)$q['bitrate'];
        if ($br<300 || $br>20000) throw new InvalidArgumentException('ENC1 V3 bitrate must be 300-20000 kb/s');
        $out['bitrate']=$br;
    }
    if (isset($q['autoBitrate'])) $out['autoBitrate']=$q['autoBitrate']===true;
    if (isset($q['rcmode'])) {
        $rc=strtolower((string)$q['rcmode']);
        if (!in_array($rc,['cbr','vbr','avbr'],true)) throw new InvalidArgumentException('Unsupported rate control');
        $out['rcmode']=$rc;
    }
    return $out;
}
function studio_save_config(array $changes): array {
    $cfg=studio_load_config();
    if (isset($changes['source'])) {
        $src=strtoupper((string)$changes['source']);
        if (!preg_match('/^(AUTO|PROGRAM|HDMI|USB|USBCAM|NET[1-4])$/',$src)) throw new InvalidArgumentException('Unknown source');
        $cfg['source']=$src;
    }
    if (isset($changes['record']) && is_array($changes['record'])) $cfg['record']=studio_validate_quality($changes['record'],$cfg['record']);
    if (isset($changes['live']) && is_array($changes['live'])) $cfg['live']=studio_validate_quality($changes['live'],$cfg['live']);
    if (isset($changes['recordSources']) && is_array($changes['recordSources'])) $cfg['recordSources']=array_values($changes['recordSources']);
    if (isset($changes['programAudio']) && is_array($changes['programAudio'])) $cfg['programAudio']=array_values(array_unique(array_map('intval',$changes['programAudio'])));
    if (isset($changes['recordFragmentSeconds'])) $cfg['recordFragmentSeconds']=max(60,min(21600,(int)$changes['recordFragmentSeconds']));
    write_json_atomic(STUDIO_CONFIG,$cfg);
    return $cfg;
}
function studio_load_providers(): array {
    $all=studio_provider_defaults(); $stored=load_json_file(STUDIO_PROVIDERS,[]);
    foreach ($all as $name=>$base) if (isset($stored[$name]) && is_array($stored[$name])) $all[$name]=studio_merge_known($base,$stored[$name]);
    return $all;
}
function studio_public_providers(): array {
    $out=[];
    foreach (studio_load_providers() as $name=>$p) $out[$name]=[
        'label'=>$p['label'],'mode'=>$p['mode'],
        'enabled'=>($p['enabled']??false)===true,
        'serverConfigured'=>(string)($p['server']??'')!=='',
        'keyConfigured'=>(string)($p['streamKey']??'')!=='',
        'srtConfigured'=>(string)($p['srtUrl']??'')!=='',
        'codec'=>$p['codec']??'h264','note'=>$p['note']??'',
        'remoteMode'=>$p['remoteMode']??null,
        'remoteHost'=>(string)($p['remoteHost']??''),
        'remotePort'=>(int)($p['remotePort']??0),
        'latency'=>(int)($p['latency']??120),
        'passphraseConfigured'=>(string)($p['passphrase']??'')!=='',
        'relayPublishConfigured'=>(string)($p['relayPublishUrl']??'')!=='',
        'relayReadConfigured'=>(string)($p['relayReadUrl']??'')!=='',
        'relayWebConfigured'=>(string)($p['relayWebUrl']??'')!=='',
    ];
    return $out;
}
function studio_save_provider(string $name,array $body): array {
    $all=studio_load_providers();
    if (!isset($all[$name])) throw new InvalidArgumentException('Unknown provider');
    if (isset($body['mode'])) {
        $mode=strtolower((string)$body['mode']);
        if (!in_array($mode,['rtmp','rtmps','srt'],true)) throw new InvalidArgumentException('Unsupported provider mode');
        $all[$name]['mode']=$mode;
    }
    if (array_key_exists('server',$body)) {
        $server=trim((string)$body['server']);
        if ($server!=='' && !preg_match('#^rtmps?://#i',$server)) throw new InvalidArgumentException('Server must use RTMP or RTMPS');
        $all[$name]['server']=rtrim($server,'/');
    }
    if (array_key_exists('streamKey',$body)) $all[$name]['streamKey']=trim((string)$body['streamKey']);
    if (array_key_exists('srtUrl',$body)) {
        $url=trim((string)$body['srtUrl']);
        if ($url!=='' && !preg_match('#^srt://#i',$url)) throw new InvalidArgumentException('SRT URL must start with srt://');
        $all[$name]['srtUrl']=$url;
    }
    if ($name==='remoteobs') {
        if (isset($body['remoteMode'])) {
            $m=strtolower((string)$body['remoteMode']);
            if (!in_array($m,['direct','relay'],true)) throw new InvalidArgumentException('Remote OBS mode must be direct or relay');
            $all[$name]['remoteMode']=$m;
        }
        if (array_key_exists('remoteHost',$body)) $all[$name]['remoteHost']=trim((string)$body['remoteHost']);
        if (array_key_exists('remotePort',$body)) {
            $port=(int)$body['remotePort']; if ($port<1 || $port>65535) throw new InvalidArgumentException('Remote OBS port invalid');
            $all[$name]['remotePort']=$port;
        }
        if (array_key_exists('latency',$body)) $all[$name]['latency']=max(20,min(8000,(int)$body['latency']));
        if (array_key_exists('passphrase',$body)) {
            $pass=(string)$body['passphrase'];
            if ($pass!=='' && (strlen($pass)<10 || strlen($pass)>79)) throw new InvalidArgumentException('SRT passphrase must be 10-79 characters');
            $all[$name]['passphrase']=$pass;
        }
        foreach (['relayPublishUrl','relayReadUrl'] as $field) if (array_key_exists($field,$body)) {
            $url=trim((string)$body[$field]);
            if ($url!=='' && !preg_match('#^srt://#i',$url)) throw new InvalidArgumentException($field.' must start with srt://');
            $all[$name][$field]=$url;
        }
        if (array_key_exists('relayWebUrl',$body)) {
            $url=trim((string)$body['relayWebUrl']);
            if ($url!=='' && !preg_match('#^https://#i',$url)) throw new InvalidArgumentException('relayWebUrl must start with https://');
            $all[$name]['relayWebUrl']=$url;
        }
    }
    if (isset($body['enabled'])) $all[$name]['enabled']=$body['enabled']===true;
    write_json_atomic(STUDIO_PROVIDERS,$all); @chmod(STUDIO_PROVIDERS,0600);
    return studio_public_providers();
}
function studio_native_config(): array {
    $c=companion_native_json('config/config.json',[]);
    if (!$c) throw new RuntimeException('Native encoder config unavailable');
    return $c;
}
function studio_usb_video_nodes(): array {
    $nodes=glob('/dev/video*')?:[];
    return array_values(array_filter($nodes,'is_file'));
}
function studio_inputs(): array {
    $r=linkpi_rpc_call('enc.getInputState');
    $rows=is_array($r)?$r:[];
    $videoNodes=studio_usb_video_nodes();
    // Firmware 5.3.x can cache getUvcInfo() after the camera has vanished.
    // Only enrich inputState when Linux still exposes a real V4L2 node.
    if ($videoNodes) try {
        $uvc=linkpi_rpc_call('enc.getUvcInfo');
        if (is_array($uvc)) foreach ($uvc as $info) {
            $id=(int)($info['id']??-1); $sizes=$info['info']['size']??null;
            if ($id<0 || !is_array($sizes) || !$sizes) continue;
            foreach ($rows as &$row) if ((int)($row['chnId']??-1)===$id) {
                $row['avalible']=true;
                if (($row['name']??'')==='') $row['name']=(string)($info['info']['name']??'USB/UVC');
                $row['uvcEnumerated']=true;
                $row['videoNodes']=$videoNodes;
            }
            unset($row);
        }
    } catch (Throwable $e) {}
    return $rows;
}
function studio_available_ids(): array {
    $ids=[];
    foreach (studio_inputs() as $x)
        if (is_array($x) && ($x['avalible']??false)===true && is_int($x['chnId']??null))
            $ids[]=$x['chnId'];
    // The native input-state RPC only reports physical HDMI/UVC inputs.
    // Net1-Net4 are decoder channels, so treat an enabled decoder with a
    // configured URL as a candidate source. Actual decode health is reflected
    // by its audio/video telemetry once the remote feed starts.
    foreach (studio_native_config() as $ch)
        if (($ch['type']??'')==='net' && ($ch['enable']??false)===true &&
            trim((string)($ch['net']['path']??''))!=='')
            $ids[]=(int)$ch['id'];
    return array_values(array_unique($ids));
}
function studio_source_id(string $src): int {
    $src=strtoupper($src);
    $map=['HDMI'=>0,'USB'=>1,'USBCAM'=>1,'PROGRAM'=>9,'NET1'=>2,'NET2'=>3,'NET3'=>4,'NET4'=>5];
    if (isset($map[$src])) return $map[$src];
    if ($src!=='AUTO') throw new InvalidArgumentException('Unknown source');
    $ids=studio_available_ids();
    if (!$ids) throw new RuntimeException('No live source available');
    return count($ids)>1?9:$ids[0];
}
function studio_dims(string $res): array {
    if ($res==='-1x-1') return [-1,-1];
    return array_map('intval',explode('x',$res,2));
}
function studio_uvc_modes(): array {
    $modes=[];
    try { $rows=linkpi_rpc_call('enc.getUvcInfo'); }
    catch (Throwable $e) { return []; }
    if (!is_array($rows)) return [];
    foreach ($rows as $row) {
        $id=(int)($row['id']??-1); $info=$row['info']??null;
        if (!is_array($info) || !is_array($info['size']??null)) continue;
        foreach ($info['size'] as $size) {
            $w=(int)($size['width']??0); $h=(int)($size['height']??0);
            foreach (($size['framerate']??[]) as $fps)
                $modes[$id][$w.'x'.$h][(int)$fps]=true;
        }
    }
    return $modes;
}
function studio_apply_usb_capture(array &$ch,array $record,array $uvcModes): void {
    if (($ch['type']??'')!=='usb') return;
    $res=(string)($record['resolution']??'-1x-1'); $fps=(int)($record['fps']??30); $id=(int)($ch['id']??-1);
    if ($res==='-1x-1') {
        $best=null; $bestPixels=-1;
        foreach (($uvcModes[$id]??[]) as $size=>$rates) {
            if (!isset($rates[$fps])) continue;
            [$cw,$chh]=array_map('intval',explode('x',$size,2)); $pixels=$cw*$chh;
            if ($pixels>$bestPixels) { $best=[$cw,$chh]; $bestPixels=$pixels; }
        }
        if ($best===null) return;
        [$w,$h]=$best;
    } else {
        [$w,$h]=studio_dims($res);
        if (isset($uvcModes[$id]) && !isset($uvcModes[$id][$w.'x'.$h][$fps]))
            throw new RuntimeException('USB camera does not expose '.$w.'x'.$h.'@'.$fps);
    }
    if (!isset($ch['capture']) || !is_array($ch['capture'])) $ch['capture']=[];
    $ch['capture']['width']=$w; $ch['capture']['height']=$h; $ch['capture']['framerate']=$fps;
}
function studio_live_codec(array $selected,array $providers,string $requested): string {
    if ($requested==='auto') {
        foreach ($selected as $name) {
            $mode=strtolower((string)($providers[$name]['mode']??'rtmp'));
            if ($name==='twitch' || ($name==='restream' && $mode!=='srt')) return 'h264';
        }
        return 'h265';
    }
    if ($requested==='h265') {
        foreach ($selected as $name) {
            $mode=strtolower((string)($providers[$name]['mode']??'rtmp'));
            if ($name==='twitch') throw new RuntimeException('Direct Twitch from LinkPi uses H.264');
            if ($name==='restream' && $mode!=='srt') throw new RuntimeException('Use Restream SRT for HEVC');
        }
    }
    return $requested;
}
function studio_auto_bitrate(array $q,array $selected,array $providers,string $codec): int {
    $res=(string)($q['resolution']??'1920x1080'); $fps=(int)($q['fps']??30);
    $high=$fps>30;
    $h265=[
        '3840x2160'=>15000,'1920x1080'=>$high?7500:5500,'1280x720'=>$high?5000:3500,
        '640x360'=>1500,'1080x1920'=>$high?7500:5500,'720x1280'=>$high?5000:3500,'360x640'=>1500,
    ];
    $h264=[
        '3840x2160'=>20000,'1920x1080'=>$high?7500:6000,'1280x720'=>$high?6000:4500,
        '640x360'=>1800,'1080x1920'=>$high?7500:6000,'720x1280'=>$high?6000:4500,'360x640'=>1800,
    ];
    $br=($codec==='h265'?$h265:$h264)[$res]??5000;
    if (in_array('youtube',$selected,true)) {
        if ($codec==='h265' && $res==='3840x2160') $br=20000;
        elseif ($res==='1920x1080') $br=max($br,$high?10000:8000);
    }
    if (in_array('twitch',$selected,true)) {
        if ($res==='3840x2160') throw new RuntimeException('Direct Twitch from LinkPi: choose 1080p or lower');
        $br=min($br,$high?7500:6000);
    }
    if (in_array('restream',$selected,true) && (($providers['restream']['mode']??'')!=='srt'))
        $br=min($br,6000);
    return max(300,min(20000,$br));
}
function studio_apply_quality(array &$ch,array $q,string $key,string $codec): void {
    if (!is_array($ch[$key]??null)) return;
    [$w,$h]=studio_dims($q['resolution']);
    $ch[$key]['width']=$w; $ch[$key]['height']=$h; $ch[$key]['framerate']=(int)$q['fps'];
    $ch[$key]['bitrate']=(int)$q['bitrate']; $ch[$key]['rcmode']=$q['rcmode'];
    $ch[$key]['codec']=$codec; $ch[$key]['profile']=$codec==='h264'?'high':'main'; $ch[$key]['gop']=2;
    if ($key==='encv2') $ch['enable2']=true;
    if (is_array($ch['enca']??null)) {
        $ch['enca']['codec']='aac'; $ch['enca']['samplerate']=48000; $ch['enca']['bitrate']=128; $ch['enca']['channels']=2;
    }
}
function studio_layouts(): array {
    $defs=companion_native_json('config/defLays.json',[]); $out=[];
    foreach ($defs as $d) if (is_array($d) && isset($d['layId']))
        $out[]=['id'=>(int)$d['layId'],'name'=>(string)($d['layNameEn']??$d['layName']??('Layout '.$d['layId'])),
            'slots'=>count($d['layouts']??[])];
    return $out;
}
function studio_apply_layout(int $layId,array $audioIds=[]): array {
    $defs=companion_native_json('config/defLays.json',[]); $chosen=null;
    foreach ($defs as $d) if ((int)($d['layId']??-1)===$layId) { $chosen=$d; break; }
    if (!$chosen) throw new InvalidArgumentException('Unknown native layout');
    $available=studio_available_ids(); if (!$available) throw new RuntimeException('No live source available');
    $config=studio_native_config(); $slots=$chosen['layouts']??[];
    $video=array_slice($available,0,count($slots)); if (!$video) throw new RuntimeException('No source fits this layout');
    $layout=[];
    foreach ($slots as $i=>$slot) {
        $pos=$slot['pos']??null; if (!is_array($pos)) continue;
        $layout[]=$pos;
    }
    foreach ($config as &$ch) if (($ch['id']??-1)===9 && ($ch['type']??'')==='mix') {
        $ch['enable']=true; $ch['srcV']=array_map('strval',$video); $ch['layout']=$layout;
        $validAudio=array_values(array_intersect(array_map('intval',$audioIds),$available));
        $ch['srcA']=array_map('strval',$validAudio?:$video);
    }
    linkpi_rpc_call('enc.update',[json_encode($config,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)]);
    return ['layoutId'=>$layId,'name'=>$chosen['layNameEn']??$chosen['layName']??'','sources'=>$video];
}
function studio_program_config(array &$config,array $video,array $audio): void {
    $video=array_values(array_unique(array_map('intval',$video)));
    $audio=array_values(array_unique(array_map('intval',$audio)));
    foreach ($config as &$ch) if (($ch['id']??-1)===9 && ($ch['type']??'')==='mix') {
        if (!$video) throw new RuntimeException('Program has no live source');
        $ch['enable']=true; $ch['srcA']=array_map('strval',$audio?:$video);
        if (count($video)===1) {
            $ch['srcV']=[strval($video[0])];
            $ch['layout']=[['a'=>1,'x'=>0,'y'=>0,'w'=>1,'h'=>1,'index'=>1]];
        } elseif (count($video)===2) {
            $ch['srcV']=array_map('strval',$video);
            $ch['layout']=[
                ['a'=>1,'x'=>0,'y'=>0,'w'=>0.5,'h'=>1,'index'=>1],
                ['a'=>1,'x'=>0.5,'y'=>0,'w'=>0.5,'h'=>1,'index'=>2],
            ];
        } else {
            $use=array_slice($video,0,4); $ch['srcV']=array_map('strval',$use); $layout=[];
            foreach ($use as $i=>$_) $layout[]=['a'=>1,'x'=>($i%2)*0.5,'y'=>intdiv($i,2)*0.5,'w'=>0.5,'h'=>0.5,'index'=>$i+1];
            $ch['layout']=$layout;
        }
        return;
    }
    throw new RuntimeException('Mix channel unavailable');
}
function studio_apply_encoder(array $cfg,int $sourceId,string $liveCodec): void {
    $config=studio_native_config(); $available=studio_available_ids(); $uvcModes=studio_uvc_modes();
    $audio=array_values(array_intersect($cfg['programAudio']??[],$available));
    if (!$audio) $audio=$available;
    if ($sourceId===9) studio_program_config($config,$available,$audio);
    foreach ($config as &$ch) {
        $id=(int)($ch['id']??-1); $type=(string)($ch['type']??'');
        $managed=(in_array($id,$available,true) && in_array($type,['vi','usb','net'],true))
            || ($id===$sourceId && in_array($type,['vi','usb','net'],true))
            || ($id===9 && $type==='mix');
        if (!$managed) continue;
        $ch['enable']=true;
        studio_apply_usb_capture($ch,$cfg['record'],$uvcModes);
        studio_apply_quality($ch,$cfg['record'],'encv',$cfg['record']['codec']==='auto'?'h265':$cfg['record']['codec']);
        studio_apply_quality($ch,$cfg['live'],'encv2',$liveCodec);
    }
    unset($ch);
    linkpi_rpc_call('enc.update',[json_encode($config,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)]);
}
function studio_srt_query(array $params): string {
    $parts=[]; foreach ($params as $k=>$v) if ($v!=='' && $v!==null) $parts[]=rawurlencode($k).'='.rawurlencode((string)$v);
    return implode('&',$parts);
}
function studio_remote_obs_urls(array $p): array {
    $mode=$p['remoteMode']??'direct';
    if ($mode==='relay') {
        $publish=trim((string)($p['relayPublishUrl']??''));
        $read=trim((string)($p['relayReadUrl']??''));
        $web=trim((string)($p['relayWebUrl']??''));
        if ($publish==='') throw new RuntimeException('Relay publish SRT URL is required');
        if ($read==='' && $web==='') throw new RuntimeException('Relay needs an SRT read URL or an HTTPS Browser Source URL');
        return ['publish'=>$publish,'read'=>$read,'web'=>$web];
    }
    $host=trim((string)($p['remoteHost']??'')); $port=(int)($p['remotePort']??0);
    if ($host==='' || $port<1 || $port>65535) throw new RuntimeException('Remote OBS host/port incomplete');
    $lat=max(20,min(8000,(int)($p['latency']??120))); $pass=(string)($p['passphrase']??'');
    $latUs=$lat*1000;
    $q=['mode'=>'caller','latency'=>$latUs]; $oq=['mode'=>'listener','latency'=>$latUs];
    if ($pass!=='') { $q['passphrase']=$pass; $q['pbkeylen']=16; $oq['passphrase']=$pass; $oq['pbkeylen']=16; }
    return [
        'publish'=>'srt://'.$host.':'.$port.'?'.studio_srt_query($q),
        'read'=>'srt://0.0.0.0:'.$port.'?'.studio_srt_query($oq),
    ];
}

function studio_remote_obs_preview(array $body): array {
    $p=studio_provider_defaults()['remoteobs'];
    foreach ($body as $k=>$v) if (array_key_exists($k,$p)) $p[$k]=$v;
    $urls=studio_remote_obs_urls($p);
    return ['publishUrl'=>$urls['publish'],'obsUrl'=>$urls['read']??'','browserUrl'=>$urls['web']??'',
        'obsInputFormat'=>'mpegts','codec'=>$body['codec']??'h265'];
}
function studio_remote_obs_saved_link(): array {
    $p=studio_load_providers()['remoteobs'] ?? null;
    if (!is_array($p)) throw new RuntimeException('Remote OBS provider unavailable');
    $urls=studio_remote_obs_urls($p);
    return ['obsUrl'=>$urls['read']??'','browserUrl'=>$urls['web']??'',
        'obsInputFormat'=>'mpegts','codec'=>$p['codec']??'h265'];
}
function studio_provider_path(array $p): string {
    if (($p['label']??'')==='Remote OBS') return studio_remote_obs_urls($p)['publish'];
    if (($p['mode']??'')==='srt') {
        $u=trim((string)($p['srtUrl']??''));
        if ($u==='') throw new RuntimeException('SRT URL missing');
        return $u;
    }
    $server=rtrim(trim((string)($p['server']??'')),'/'); $key=ltrim(trim((string)($p['streamKey']??'')),'/');
    if ($server==='' || $key==='') throw new RuntimeException('Provider URL/key incomplete');
    return $server.'/'.$key;
}

function studio_push_state_safe($raw): array {
    if (!is_array($raw)) return ['pushing'=>false,'duration'=>0,'speed'=>[],'destinations'=>[]];
    $out=[
        'pushing'=>($raw['pushing']??false)===true,
        'duration'=>(int)($raw['duration']??0),
        'speed'=>array_values(array_map('intval',is_array($raw['speed']??null)?$raw['speed']:[])),
        'destinations'=>[],
    ];
    foreach (($raw['status']??[]) as $i=>$row) if (is_array($row)) {
        $out['destinations'][]=[
            'index'=>$i,
            'duration'=>(int)($row['duration']??0),
            'speed'=>(int)($row['speed']??0),
            'type'=>(string)($row['type']??''),
        ];
    }
    return $out;
}
function studio_provider_is_srt(string $name,array $provider): bool {
    return $name==='remoteobs' || strtolower((string)($provider['mode']??''))==='srt';
}
function studio_srt_target(string $url,int $defaultLatency=700): array {
    $parts=parse_url($url);
    if (!is_array($parts) || strtolower((string)($parts['scheme']??''))!=='srt')
        throw new InvalidArgumentException('Invalid SRT URL');
    $host=trim((string)($parts['host']??'')); $port=(int)($parts['port']??0);
    if ($host==='' || $port<1 || $port>65535) throw new InvalidArgumentException('SRT host/port missing');
    $q=[]; parse_str((string)($parts['query']??''),$q);
    $mode=strtolower((string)($q['mode']??'caller'));
    if (!in_array($mode,['caller','listener','rendezvous'],true)) $mode='caller';
    $lat=(int)($q['latency']??$defaultLatency);
    if ($lat>8000) $lat=(int)round($lat/1000);
    $lat=max(20,min(8000,$lat));
    return [
        'enable'=>true,'mode'=>$mode,'ip'=>$host,'port'=>$port,'latency'=>$lat,
        'passwd'=>(string)($q['passphrase']??''),'streamid'=>(string)($q['streamid']??''),
    ];
}
function studio_native_srt_state(?array $config=null): array {
    $config=$config??studio_native_config();
    foreach ($config as $ch) {
        if (!is_array($ch) || !is_int($ch['id']??null)) continue;
        $srt=$ch['stream2']['srt']??null;
        if (is_array($srt) && ($srt['enable']??false)===true) {
            return [
                'active'=>true,'channelId'=>$ch['id'],'channelName'=>(string)($ch['name']??''),
                'mode'=>(string)($srt['mode']??''),'port'=>(int)($srt['port']??0),
                'encrypted'=>(string)($srt['passwd']??'')!=='',
                'streamIdConfigured'=>(string)($srt['streamid']??'')!=='',
            ];
        }
    }
    return ['active'=>false,'channelId'=>null,'channelName'=>'','mode'=>'','port'=>0,'encrypted'=>false,'streamIdConfigured'=>false];
}
function studio_set_native_srt(?int $sourceId,?string $url=null,int $defaultLatency=700): array {
    $config=studio_native_config(); $found=$sourceId===null;
    foreach ($config as &$ch) {
        if (!is_array($ch) || !is_int($ch['id']??null) || !is_array($ch['stream2']['srt']??null)) continue;
        $ch['stream2']['srt']['enable']=false;
        $ch['stream2']['srt']['mode']='listener';
        $ch['stream2']['srt']['ip']='127.0.0.1';
        $ch['stream2']['srt']['passwd']='';
        $ch['stream2']['srt']['streamid']='';
        if ($sourceId!==null && $ch['id']===$sourceId) {
            $target=studio_srt_target((string)$url,$defaultLatency);
            $ch['enable2']=true;
            foreach ($target as $k=>$v) $ch['stream2']['srt'][$k]=$v;
            $found=true;
        }
    }
    unset($ch);
    if (!$found) throw new RuntimeException('Selected source has no native SRT output');
    // Firmware >= 3.6 uses /conf/updateDefaultConf for stream.php:
    // persist config.json then reload the encoder. The lightweight hot-update
    // path does not reliably start/stop native SRT callers on 5.3.x.
    studio_native_func('/conf/updateDefaultConf',$config);
    usleep(900000);
    return studio_native_srt_state();
}
function studio_stream_state(): array {
    $raw=null;
    try { $raw=linkpi_rpc_call('push.getState'); } catch (Throwable $e) {}
    $push=studio_push_state_safe($raw);
    $srt=studio_native_srt_state();
    $push['nativeSrt']=$srt;
    $push['pushing']=$push['pushing'] || $srt['active'];
    return $push;
}
function studio_start_stream(array $body): array {
    $cfg=studio_save_config($body); $all=studio_load_providers(); $selected=$body['providers']??[];
    if (!is_array($selected) || !$selected) throw new InvalidArgumentException('Select at least one provider');
    foreach ($selected as $name) if (!isset($all[$name])) throw new InvalidArgumentException('Unknown provider');
    $srtNames=[]; $pushNames=[];
    foreach ($selected as $name) {
        if (studio_provider_is_srt($name,$all[$name])) $srtNames[]=$name; else $pushNames[]=$name;
    }
    if (count($srtNames)>1)
        throw new RuntimeException('LinkPi SUB exposes one native SRT destination at a time. Use Restream for multistream or keep only one SRT target.');
    $sourceId=studio_source_id($cfg['source']);
    $codec=studio_live_codec($selected,$all,$cfg['live']['codec']);
    if (($cfg['live']['autoBitrate']??false)===true)
        $cfg['live']['bitrate']=studio_auto_bitrate($cfg['live'],$selected,$all,$codec);
    studio_apply_encoder($cfg,$sourceId,$codec);

    if ($srtNames) {
        $name=$srtNames[0]; $p=$all[$name]; $url=studio_provider_path($p);
        $defaultLatency=$name==='restream'?700:(int)($p['latency']??120);
        studio_set_native_srt($sourceId,$url,$defaultLatency);
    } else {
        studio_set_native_srt(null);
    }

    $urls=[];
    foreach ($pushNames as $name) {
        $p=$all[$name]; $path=studio_provider_path($p);
        $urls[]=[
            'des'=>$p['label'],'enable'=>true,
            'flvflags'=>$codec==='h265' && preg_match('#^rtmps?://#i',$path)?'ext_header':'',
            'path'=>$path,'srcA'=>$sourceId===9?9:$sourceId,'srcV'=>$sourceId,
            'stream'=>'sub','type'=>'normal',
        ];
    }
    linkpi_rpc_call('push.stop');
    $push=['autorun'=>false,'url'=>$urls];
    linkpi_rpc_call('push.update',[json_encode($push,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)]);
    if ($urls) linkpi_rpc_call('push.start');
    usleep(250000);
    return ['sourceId'=>$sourceId,'codec'=>$codec,'bitrate'=>$cfg['live']['bitrate'],'stream'=>'sub','state'=>studio_stream_state()];
}
function studio_stop_stream(): array {
    try { linkpi_rpc_call('push.stop'); } catch (Throwable $e) {}
    try {
        linkpi_rpc_call('push.update',[json_encode(['autorun'=>false,'url'=>[]],JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT)]);
    } catch (Throwable $e) {}
    try { studio_set_native_srt(null); } catch (Throwable $e) {}
    usleep(100000);
    return ['state'=>studio_stream_state()];
}
function studio_storage_state(): array {
    $disk=companion_native_json('config/misc/disk.json',[]); $devices=glob('/dev/sd*[0-9]')?:[];
    $configured=(string)($disk['local']['device']??'');
    $external=$configured!=='' && !str_starts_with($configured,'/dev/mmcblk');
    $mounted=false;
    try { $mounted=linkpi_rpc_call('rec.isMountDisk')===true; } catch (Throwable $e) {}
    return ['devices'=>array_values(array_unique($devices)),'configuredDevice'=>$configured,
        'externalConfigured'=>$external,'mounted'=>$mounted&&$external,'recordRoot'=>'/root/usb','browserRoot'=>'/files/'];
}
function studio_mount_storage(string $device): array {
    if (!preg_match('#^/dev/sd[a-z][0-9]+$#',$device) || !file_exists($device)) throw new InvalidArgumentException('External disk not found');
    $disk=companion_native_json('config/misc/disk.json',[]);
    if (!$disk) throw new RuntimeException('Disk config unavailable');
    $disk['enable']=true; $disk['used']='local'; if (!isset($disk['local'])) $disk['local']=[];
    $disk['local']['device']=$device; write_json_atomic('/link/config/misc/disk.json',$disk);
    $out=[]; $rc=0; exec('/link/shell/mount.sh 2>&1',$out,$rc);
    if ($rc!==0) throw new RuntimeException('LinkPi mount failed: '.implode(' ',$out));
    return studio_storage_state();
}
function studio_record_ids(array $requested): array {
    $available=studio_available_ids(); $upper=array_map(fn($v)=>strtoupper((string)$v),$requested);
    if (in_array('ALL',$upper,true) || in_array('AUTO',$upper,true)) {
        $ids=array_values(array_filter($available,fn($id)=>$id>=0 && $id<=5));
        if (count($ids)>1) $ids[]=9;
        return array_values(array_unique($ids));
    }
    return array_values(array_unique(array_map(fn($s)=>studio_source_id((string)$s),$requested)));
}
function studio_start_record(array $body): array {
    $cfg=studio_save_config($body); $storage=studio_storage_state();
    if (!$storage['mounted']) throw new RuntimeException('No external storage mounted');
    $requested=is_array($body['recordSources']??null)?$body['recordSources']:$cfg['recordSources'];
    $ids=studio_record_ids($requested); if (!$ids) throw new RuntimeException('No live channel selected');
    $sourceId=count($ids)>1?9:$ids[0];
    studio_apply_encoder($cfg,$sourceId,$cfg['live']['codec']==='h265'?'h265':'h264');
    $record=companion_native_json('config/record.json',[]);
    $record['auto']=false; $record['chns']=$ids; $record['type']='normal';
    $record['format']=['flv'=>false,'mkv'=>false,'mov'=>false,'mp4'=>true,'ts'=>false];
    $record['fragment']=['enable'=>true,'mode'=>'dura','dura'=>$cfg['recordFragmentSeconds'],'size'=>500];
    linkpi_rpc_call('rec.update',[json_encode($record,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)]);
    if (linkpi_rpc_call('rec.start')!==true) throw new RuntimeException('LinkPi refused recording start');
    return ['channels'=>$ids,'recordRoot'=>'/root/usb','browserRoot'=>'/files/','state'=>companion_sanitize(linkpi_rpc_call('rec.getRecChnsState'))];
}
function studio_stop_record(): array {
    linkpi_rpc_call('rec.stop'); usleep(100000);
    return ['state'=>companion_sanitize(linkpi_rpc_call('rec.getRecChnsState'))];
}
function studio_native_func(string $url,array $data): array {
    $payload=json_encode(['url'=>$url,'data'=>$data],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
    $ctx=stream_context_create(['http'=>[
        'method'=>'POST','timeout'=>3,'ignore_errors'=>true,
        'header'=>"Content-Type: application/json\r\nContent-Length: ".strlen($payload)."\r\n",
        'content'=>$payload,
    ]]);
    $raw=@file_get_contents('http://127.0.0.1/link/relay.php',false,$ctx);
    $decoded=is_string($raw)?json_decode($raw,true):null;
    if (!is_array($decoded) || ($decoded['status']??'')!=='success')
        throw new RuntimeException('Native LinkPi config update failed');
    return $decoded;
}
function studio_srt_receiver_url(int $port,int $latency,string $passphrase='',string $streamid='',string $mode='listener'): string {
    $q=['mode'=>$mode,'latency'=>$latency];
    if ($passphrase!=='') $q['passphrase']=$passphrase;
    if ($streamid!=='') $q['streamid']=$streamid;
    return 'srt://127.0.0.1:'.$port.'?'.studio_srt_query($q);
}
function studio_set_network_source(array $body): array {
    $slot=(int)($body['slot']??1); if ($slot<1 || $slot>4) throw new InvalidArgumentException('Network slot must be 1-4');
    $id=$slot+1; $url=trim((string)($body['url']??''));
    if ($url==='' || !preg_match('#^(rtsp|rtmp|rtmps|srt|udp|rist|https?)://#i',$url)) throw new InvalidArgumentException('Unsupported network source URL');
    $config=studio_native_config(); $found=false; $publisherUrl=null;
    $scheme=strtolower((string)(parse_url($url,PHP_URL_SCHEME)??''));

    if ($scheme==='srt') {
        $parts=parse_url($url); $port=(int)($parts['port']??0);
        if ($port<1 || $port>65535) throw new InvalidArgumentException('SRT receiver port missing');
        $q=[]; parse_str((string)($parts['query']??''),$q);
        $lat=(int)($q['latency']??120); if ($lat>8000) $lat=(int)round($lat/1000); $lat=max(20,min(8000,$lat));
        $pass=(string)($q['passphrase']??''); $streamid=(string)($q['streamid']??'');
        if ($pass!=='' && (strlen($pass)<10 || strlen($pass)>79)) throw new InvalidArgumentException('SRT passphrase must be 10-79 characters');

        $receiver=companion_native_json('config/misc/receiver.json',['rtmp'=>[],'srt'=>[],'ndi'=>[]]);
        if (!isset($receiver['srt']) || !is_array($receiver['srt'])) $receiver['srt']=[];
        $item=[
            'desc'=>'Companion Net'.$slot,'bind'=>$id,'port'=>(string)$port,'latency'=>(string)$lat,
            'passphrase'=>$pass,'streamid'=>$streamid,
            'url'=>studio_srt_receiver_url($port,$lat,$pass,$streamid,'caller'),
        ];
        $replaced=false;
        foreach ($receiver['srt'] as $i=>$old) if ((int)($old['bind']??-1)===$id || ($old['desc']??'')==='Companion Net'.$slot) {
            $receiver['srt'][$i]=$item; $replaced=true; break;
        }
        if (!$replaced) $receiver['srt'][]=$item;
        studio_native_func('/conf/updateReceiverConf',$receiver);
        $url=studio_srt_receiver_url($port,$lat,$pass,$streamid,'listener');
        $host=trim((string)($body['publishHost']??''));
        $publisherUrl='srt://'.($host!==''?$host:'<LINKPI_HOST>').':'.$port.'?'.studio_srt_query(array_filter([
            'mode'=>'caller','latency'=>$lat*1000,'passphrase'=>$pass,'streamid'=>$streamid
        ],fn($v)=>$v!==''));
    }

    foreach ($config as &$ch) if (($ch['id']??-1)===$id && ($ch['type']??'')==='net') {
        $found=true; $ch['name']=trim((string)($body['name']??('Net'.$slot)))?:('Net'.$slot); $ch['enable']=true;
        $ch['net']['path']=$url; $ch['net']['decodeV']=($body['video']??true)===true; $ch['net']['decodeA']=($body['audio']??true)===true;
        $ch['net']['bufferMode']=(int)($body['bufferMode']??1); $ch['net']['minDelay']=max(0,min(5000,(int)($body['minDelay']??300)));
        $ch['net']['protocol']=strtolower((string)($body['transport']??'tcp'))==='udp'?'udp':'tcp';
    }
    unset($ch);
    if (!$found) throw new RuntimeException('Network decoder slot unavailable');
    linkpi_rpc_call('enc.update',[json_encode($config,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)]);
    return ['slot'=>$slot,'channelId'=>$id,'configured'=>true,'publisherUrl'=>$publisherUrl];
}
function studio_disable_network_source(int $slot): array {
    if ($slot<1 || $slot>4) throw new InvalidArgumentException('Network slot must be 1-4');
    $id=$slot+1; $config=studio_native_config();
    foreach ($config as &$ch) if (($ch['id']??-1)===$id && ($ch['type']??'')==='net') {
        $ch['name']='Net'.$slot;
        $ch['enable']=false; $ch['net']['decodeV']=false; $ch['net']['decodeA']=false; $ch['net']['path']='';
    }
    unset($ch);
    linkpi_rpc_call('enc.update',[json_encode($config,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)]);
    $receiver=companion_native_json('config/misc/receiver.json',[]);
    if (isset($receiver['srt']) && is_array($receiver['srt'])) {
        $receiver['srt']=array_values(array_filter($receiver['srt'],fn($x)=>(int)($x['bind']??-1)!==$id && ($x['desc']??'')!=='Companion Net'.$slot));
        try { studio_native_func('/conf/updateReceiverConf',$receiver); } catch (Throwable $e) {}
    }
    return ['slot'=>$slot,'channelId'=>$id,'enabled'=>false];
}
function studio_state(): array {
    $config=studio_native_config(); $channels=[];
    foreach ($config as $ch) {
        if (!is_array($ch) || !is_int($ch['id']??null) || !in_array($ch['type']??'',['vi','usb','net','mix'],true)) continue;
        $channels[]=['id'=>$ch['id'],'name'=>$ch['name']??'','type'=>$ch['type']??'','enabled'=>($ch['enable']??false)===true,
            'subEnabled'=>($ch['enable2']??false)===true,'main'=>companion_sanitize($ch['encv']??[]),
            'sub'=>companion_sanitize($ch['encv2']??[]),'audio'=>companion_sanitize($ch['enca']??[]),
            'networkConfigured'=>($ch['type']??'')==='net'?!empty($ch['net']['path']):null];
    }
    $rec=null;
    try { $rec=linkpi_rpc_call('rec.getRecChnsState'); } catch (Throwable $e) {}
    $ad=function_exists('current_state')?current_state():[];
    return ['config'=>studio_load_config(),'providers'=>studio_public_providers(),'resolutions'=>studio_resolutions(),
        'fps'=>studio_fps_values(),'layouts'=>studio_layouts(),'inputs'=>companion_sanitize(studio_inputs()),'channels'=>$channels,
        'storage'=>studio_storage_state(),'stream'=>studio_stream_state(),'recording'=>companion_sanitize($rec),
        'autodirector'=>['mode'=>$ad['mode']??'OFF','readiness'=>$ad['readiness']??['autoReady'=>false]]];
}


function studio_layout_item(int $id,string $name,array $pos,int $key): array {
    return ['id'=>$id,'name'=>$name,'lock'=>true,'enable'=>true,'key'=>$key,'ado'=>false,'pos'=>$pos];
}
function studio_prepare_layouts(int $a,int $b): array {
    if ($a===$b) throw new InvalidArgumentException('CAM A and CAM B must be different');
    $cfg=studio_native_config(); $names=[];
    foreach ($cfg as $ch) if (is_int($ch['id']??null)) $names[$ch['id']]=$ch['name']??('CH'.$ch['id']);
    $defs=companion_native_json('config/defLays.json',[]);
    if (!$defs) throw new RuntimeException('Native layouts unavailable');
    $specs=[
      'CAM_A'=>['Companion CAM A',[$a]],
      'CAM_B'=>['Companion CAM B',[$b]],
      'SPLIT'=>['Companion SPLIT',[$a,$b]],
    ];
    $map=[];
    foreach ($specs as $scene=>[$label,$ids]) {
        $idx=null;
        foreach ($defs as $i=>$def) if (($def['layNameEn']??'')===$label) { $idx=$i; break; }
        if ($idx===null) { $idx=count($defs); $defs[]=['layId'=>$idx,'layName'=>$label,'layNameEn'=>$label,'enable'=>false,'layouts'=>[]]; }
        $defs[$idx]['layId']=$idx; $defs[$idx]['layName']=$label; $defs[$idx]['layNameEn']=$label; $defs[$idx]['enable']=false;
        if (count($ids)===1) {
            $id=$ids[0]; $defs[$idx]['layouts']=[studio_layout_item($id,$names[$id]??('CH'.$id),
              ['a'=>1,'x'=>0,'y'=>0,'w'=>1,'h'=>1,'index'=>1],91000+$idx)];
        } else {
            $defs[$idx]['layouts']=[
              studio_layout_item($ids[0],$names[$ids[0]]??('CH'.$ids[0]),['a'=>1,'x'=>0,'y'=>0,'w'=>0.5,'h'=>1,'index'=>1],92000+$idx),
              studio_layout_item($ids[1],$names[$ids[1]]??('CH'.$ids[1]),['a'=>1,'x'=>0.5,'y'=>0,'w'=>0.5,'h'=>1,'index'=>2],93000+$idx),
            ];
        }
        $map[$scene]=$idx;
    }
    write_json_atomic('/link/config/defLays.json',$defs);
    return $map;
}

function studio_prepare_autodirector(array $body): array {
    $a=(int)($body['cameraA']??0); $b=(int)($body['cameraB']??1);
    $audioA=(int)($body['audioA']??$a); $audioB=(int)($body['audioB']??$b);
    foreach ([$a,$b,$audioA,$audioB] as $id) if ($id<0 || $id>9) throw new InvalidArgumentException('Channel id out of range');
    $map=studio_prepare_layouts($a,$b);
    $carousel=companion_native_json('config/misc/carousel.json',[]);
    if (!$carousel) throw new RuntimeException('Carousel config unavailable');
    $carousel['active']='layout'; $carousel['autorun']=false;
    if (!isset($carousel['modes']['layout'])) $carousel['modes']['layout']=[];
    $carousel['modes']['layout']['source1']=[
      ['layId'=>$map['CAM_A'],'hold'=>'dur','duration'=>86400],
      ['layId'=>$map['CAM_B'],'hold'=>'dur','duration'=>86400],
      ['layId'=>$map['SPLIT'],'hold'=>'dur','duration'=>86400],
    ];
    $carousel['modes']['layout']['audio']=['type'=>'layout','line'=>true,'mixA'=>array_values(array_unique([$audioA,$audioB]))];
    try { linkpi_rpc_call('carousel.stop'); } catch (Throwable $e) {}
    linkpi_rpc_call('carousel.update',[$carousel]);
    linkpi_rpc_call('carousel.start');
    usleep(250000);
    $state=linkpi_rpc_call('carousel.getState');
    $ready=is_array($state) && ($state['hadCarousel']??false)===true && ($state['activeMode']??'')==='layout';

    $hw=load_json_file(AD_HARDWARE,[]);
    $hw['detectors']['a']=['channelId'=>$audioA,'side'=>'max'];
    $hw['detectors']['b']=['channelId'=>$audioB,'side'=>'max'];
    $hw['videoSources']=['a'=>$a,'b'=>$b];
    $hw['sceneToLayId']=$map;
    $hw['scenesReady']=$ready;
    $hw['carouselSourceKey']='source1';
    if (!isset($hw['calibration'])) $hw['calibration']=['a'=>null,'b'=>null];
    write_json_atomic(AD_HARDWARE,$hw);
    return ['hardware'=>$hw,'carouselReady'=>$ready,'carousel'=>companion_sanitize($state)];
}

function studio_calibrate(array $body): array {
    $speaker=strtolower((string)($body['speaker']??''));
    $phase=strtolower((string)($body['phase']??''));
    if (!in_array($speaker,['a','b'],true) || !in_array($phase,['noise','speech'],true))
        throw new InvalidArgumentException('Calibration target invalid');
    $hw=load_json_file(AD_HARDWARE,[]);
    $det=$hw['detectors'][$speaker]??null;
    if (!is_array($det) || !is_int($det['channelId']??null)) throw new RuntimeException('Detector is not configured');
    $id=$det['channelId']; $values=[];
    for ($i=0;$i<12;$i++) {
        $vol=linkpi_rpc_call('enc.getVolume');
        $m=$vol[$id]??null;
        if (is_array($m) && is_numeric($m['L']??null) && is_numeric($m['R']??null))
            $values[]=max((float)$m['L'],(float)$m['R']);
        usleep(100000);
    }
    if (!$values) throw new RuntimeException('No audio meter samples');
    sort($values);
    $value=$phase==='noise' ? $values[count($values)-1] : $values[(int)floor((count($values)-1)*0.6)];
    $cal=is_array($hw['calibration'][$speaker]??null)?$hw['calibration'][$speaker]:['noiseFloor'=>null,'speechReference'=>null];
    $cal[$phase==='noise'?'noiseFloor':'speechReference']=round($value,3);
    if ($phase==='speech' && is_numeric($cal['noiseFloor']??null) && $cal['speechReference'] <= $cal['noiseFloor'])
        throw new RuntimeException('Speech level is not above noise floor');
    $hw['calibration'][$speaker]=$cal;
    write_json_atomic(AD_HARDWARE,$hw);
    return ['speaker'=>$speaker,'phase'=>$phase,'value'=>round($value,3),'calibration'=>$cal,'ready'=>valid_calibration($cal)];
}
