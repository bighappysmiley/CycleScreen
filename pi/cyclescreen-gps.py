#!/usr/bin/env python3
"""CycleScreen GPS bridge.

Chromium's navigator.geolocation does NOT read gpsd/the GPS dongle on Linux, so
this reads the GLONASS/GPS dongle via gpsd and serves the live position over a
localhost HTTP endpoint that CycleScreen polls (device.js prefers it over the
browser's location).

Requires gpsd running and pointed at the dongle:
    sudo apt install gpsd gpsd-clients
    # set DEVICES="/dev/ttyACM0" in /etc/default/gpsd, then:
    sudo systemctl enable --now gpsd

Run:
    python3 cyclescreen-gps.py            # serves 127.0.0.1:8781
Config (env): CYCLESCREEN_GPS_PORT (8781), GPSD_HOST (127.0.0.1), GPSD_PORT (2947)
"""
import json, os, socket, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("CYCLESCREEN_GPS_PORT", "8781"))
GPSD_HOST = os.environ.get("GPSD_HOST", "127.0.0.1")
GPSD_PORT = int(os.environ.get("GPSD_PORT", "2947"))

state = {"lat": None, "lng": None, "speed": None, "heading": None, "accuracy": None, "sats": None, "ts": 0}
lock = threading.Lock()


def reader():
    """Stay connected to gpsd and keep `state` updated from TPV/SKY reports."""
    while True:
        try:
            s = socket.create_connection((GPSD_HOST, GPSD_PORT), timeout=5)
            s.sendall(b'?WATCH={"enable":true,"json":true}\n')
            buf = b""
            while True:
                data = s.recv(4096)
                if not data:
                    break
                buf += data
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    try:
                        r = json.loads(line.decode("utf-8", "ignore"))
                    except ValueError:
                        continue
                    cls = r.get("class")
                    if cls == "TPV" and r.get("lat") is not None:
                        with lock:
                            state["lat"] = r.get("lat")
                            state["lng"] = r.get("lon")
                            state["speed"] = r.get("speed")          # m/s
                            state["heading"] = r.get("track")        # degrees
                            # horizontal error estimate ≈ accuracy in metres
                            state["accuracy"] = r.get("eph") or r.get("epx")
                            state["ts"] = time.time()
                    elif cls == "SKY" and r.get("satellites") is not None:
                        with lock:
                            state["sats"] = sum(1 for sv in r["satellites"] if sv.get("used"))
        except Exception:
            time.sleep(3)  # gpsd not up yet / dropped — retry


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        if not self.path.startswith("/position"):
            self.send_response(404); self._cors(); self.end_headers(); return
        with lock:
            fresh = state["lat"] is not None and (time.time() - state["ts"] < 10)
            body = json.dumps(state if fresh else {"lat": None}).encode()
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def log_message(self, *a): pass


if __name__ == "__main__":
    threading.Thread(target=reader, daemon=True).start()
    print(f"CycleScreen GPS bridge: http://127.0.0.1:{PORT}/position  (gpsd {GPSD_HOST}:{GPSD_PORT})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
