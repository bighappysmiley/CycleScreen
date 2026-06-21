#!/usr/bin/env python3
"""CycleScreen local-music server.

Serves a folder of audio files (e.g. the folder your phone drops songs into
over Bluetooth) to the CycleScreen kiosk so they appear automatically in the
Music app's "Local" tab — no manual importing.

Bluetooth receiving (one-time): install an OBEX push receiver that saves into
the music folder, e.g.:
    sudo apt install bluez obexpushd
    obexpushd -B -o ~/Music -n          # accept files into ~/Music

Run this server:
    python3 cyclescreen-music.py         # serves ~/Music on 127.0.0.1:8780
Config (env):
    CYCLESCREEN_MUSIC_DIR   default ~/Music
    CYCLESCREEN_MUSIC_PORT  default 8780
"""
import json, os, re, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MUSIC_DIR = os.path.expanduser(os.environ.get("CYCLESCREEN_MUSIC_DIR", "~/Music"))
PORT = int(os.environ.get("CYCLESCREEN_MUSIC_PORT", "8780"))
EXTS = (".mp3", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".wav", ".flac", ".webm")
MIME = {".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg",
        ".oga": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac",
        ".webm": "audio/webm"}
CALIB_FILE = os.path.expanduser("~/.config/cyclescreen/touch-matrix")


def save_calibration(matrix):
    """Persist the touch matrix; the kiosk X session applies it on start."""
    os.makedirs(os.path.dirname(CALIB_FILE), exist_ok=True)
    with open(CALIB_FILE, "w") as f:
        f.write(" ".join(repr(x) for x in matrix) + "\n")


def apply_calibration(matrix):
    """Best-effort live apply via xinput (needs the running X session)."""
    import subprocess
    env = dict(os.environ); env.setdefault("DISPLAY", ":0")
    if "XAUTHORITY" not in env:
        for p in (os.path.expanduser("~/.Xauthority"), f"/run/user/{os.getuid()}/gdm/Xauthority"):
            if os.path.exists(p):
                env["XAUTHORITY"] = p; break
    try:
        names = subprocess.run(["xinput", "list", "--name-only"], capture_output=True, text=True, env=env, timeout=5).stdout
        dev = next((n for n in names.splitlines() if "touch" in n.lower()), None)
        if not dev:
            return False
        subprocess.run(["xinput", "set-prop", dev, "Coordinate Transformation Matrix", *[str(x) for x in matrix]],
                       env=env, timeout=5, check=True)
        return True
    except Exception:
        return False


def list_tracks():
    try:
        names = sorted(f for f in os.listdir(MUSIC_DIR) if f.lower().endswith(EXTS))
    except FileNotFoundError:
        names = []
    return [{"id": n, "name": n} for n in names]


def safe_path(name):
    # prevent path traversal; only files directly in MUSIC_DIR
    name = os.path.basename(name)
    p = os.path.join(MUSIC_DIR, name)
    return p if os.path.isfile(p) and name.lower().endswith(EXTS) else None


class Handler(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")

    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/calibrate":
            self.send_response(404); self.cors(); self.end_headers(); return
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n).decode() or "{}")
            matrix = [float(x) for x in data.get("matrix", [])]
            assert len(matrix) == 9
        except Exception:
            self.send_response(400); self.cors(); self.end_headers(); return
        save_calibration(matrix)
        ok = apply_calibration(matrix)
        body = json.dumps({"ok": True, "applied": ok}).encode()
        self.send_response(200); self.cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == "/tracks":
            body = json.dumps(list_tracks()).encode()
            self.send_response(200); self.cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body))); self.end_headers()
            self.wfile.write(body); return
        if u.path == "/file":
            q = urllib.parse.parse_qs(u.query)
            p = safe_path((q.get("name") or [""])[0])
            if not p:
                self.send_response(404); self.cors(); self.end_headers(); return
            self.serve_file(p); return
        self.send_response(404); self.cors(); self.end_headers()

    def serve_file(self, p):
        size = os.path.getsize(p)
        ctype = MIME.get(os.path.splitext(p)[1].lower(), "application/octet-stream")
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        if rng and (m := re.match(r"bytes=(\d*)-(\d*)", rng)):
            if m.group(1): start = int(m.group(1))
            if m.group(2): end = int(m.group(2))
            end = min(end, size - 1)
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.cors()
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with open(p, "rb") as f:
            f.seek(start); remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk: break
                try: self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError): break
                remaining -= len(chunk)

    def log_message(self, *a): pass


if __name__ == "__main__":
    os.makedirs(MUSIC_DIR, exist_ok=True)
    print(f"CycleScreen music server: http://127.0.0.1:{PORT}  (folder: {MUSIC_DIR})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
