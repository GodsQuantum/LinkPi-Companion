#!/usr/bin/env python3
import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

log_path = Path(sys.argv[1])
service = {"telnet": True, "ssh": True, "php": True, "nginx": True,
           "crond": True, "onvif": True, "ndi": True, "sls": True,
           "frp": False, "trans": False}
ntp = {"enable": True, "server": "old.example", "interval": 5}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send_json(self, obj):
        data = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_GET(self):
        if self.path.startswith('/config/service.json'):
            return self.send_json(service)
        if self.path.startswith('/config/ntp.json'):
            return self.send_json(ntp)
        if self.path == '/':
            self.send_response(200); self.end_headers(); return
        self.send_response(404); self.end_headers()

    def do_POST(self):
        if self.path != '/link/relay.php':
            self.send_response(404); self.end_headers(); return
        length = int(self.headers.get('content-length', 0))
        body = json.loads(self.rfile.read(length) or b'{}')
        log = json.loads(log_path.read_text()) if log_path.exists() else []
        log.append(body)
        log_path.write_text(json.dumps(log))
        target = body.get('url')
        data = body.get('data')
        if target == '/conf/updateServiceConf': service.update(data)
        elif target == '/conf/updateNtpConf': ntp.update(data)
        else: return self.send_json({"status":"error"})
        self.send_json({"status":"success","msg":"save successfully","data":""})

server = HTTPServer(('127.0.0.1', 0), Handler)
print(server.server_port, flush=True)
server.serve_forever()
