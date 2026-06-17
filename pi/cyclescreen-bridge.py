#!/usr/bin/env python3
"""CycleScreen companion bridge.

Runs on the Raspberry Pi alongside the native 24six app. Surfaces 24six's
playback (via Linux MPRIS / `playerctl`) to the CycleScreen web kiosk over a
small localhost HTTP API, relays play/pause/next, launches the 24six app, and
brings the Chromium kiosk back to the foreground when a song starts.

Dependencies (Raspberry Pi OS):
    sudo apt install playerctl wmctrl xdotool

Run:
    python3 cyclescreen-bridge.py            # listens on 127.0.0.1:8765
Configure (optional env vars):
    CYCLESCREEN_PORT          default 8765
    CYCLESCREEN_24SIX_LAUNCH  command to launch 24six
                              default: "waydroid app launch app.tfs.music"
    CYCLESCREEN_KIOSK_MATCH   window match for refocus (default "chromium")
"""
import json, os, shlex, subprocess, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("CYCLESCREEN_PORT", "8765"))
LAUNCH_CMD = os.environ.get("CYCLESCREEN_24SIX_LAUNCH", "waydroid app launch app.tfs.music")
KIOSK_MATCH = os.environ.get("CYCLESCREEN_KIOSK_MATCH", "chromium")


def sh(args, timeout=5):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=timeout).stdout.strip()
    except Exception:
        return ""


def now_playing():
    fmt = "{{status}}|{{title}}|{{artist}}|{{album}}|{{mpris:artUrl}}|{{mpris:length}}"
    out = sh(["playerctl", "metadata", "--format", fmt])
    if not out:
        return {"status": "stopped"}
    parts = (out.split("|") + [""] * 6)[:6]
    status, title, artist, album, art, length = parts
    pos = sh(["playerctl", "position"])  # seconds (float)
    try:
        position_us = int(float(pos) * 1_000_000) if pos else 0
    except ValueError:
        position_us = 0
    try:
        length_us = int(length) if length else 0
    except ValueError:
        length_us = 0
    return {
        "status": (status or "stopped").lower(),
        "title": title, "artist": artist, "album": album,
        "artUrl": art, "position": position_us, "length": length_us,
    }


def focus_kiosk():
    if sh(["wmctrl", "-x", "-a", KIOSK_MATCH]) == "":
        # wmctrl prints nothing on success; also try xdotool as a fallback
        wid = sh(["xdotool", "search", "--class", KIOSK_MATCH])
        if wid:
            sh(["xdotool", "windowactivate", wid.splitlines()[0]])


def watch_playback():
    """Bring CycleScreen forward whenever playback transitions to Playing."""
    try:
        proc = subprocess.Popen(
            ["playerctl", "--follow", "metadata", "--format", "{{status}}"],
            stdout=subprocess.PIPE, text=True)
    except FileNotFoundError:
        return
    last = ""
    for line in proc.stdout:
        status = line.strip().lower()
        if status == "playing" and last != "playing":
            focus_kiosk()
        last = status


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body=b"", ctype="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204)

    def do_GET(self):
        if self.path.startswith("/nowplaying"):
            self._send(200, json.dumps(now_playing()).encode())
        else:
            self._send(404)

    def do_POST(self):
        p = self.path.rstrip("/")
        if p.startswith("/control/"):
            cmd = p.rsplit("/", 1)[-1]
            if cmd in ("playpause", "play", "pause", "next", "previous", "stop"):
                sh(["playerctl", cmd])
                self._send(200, b'{"ok":true}')
            else:
                self._send(400)
        elif p == "/launch":
            try:
                subprocess.Popen(shlex.split(LAUNCH_CMD))
            except Exception:
                pass
            self._send(200, b'{"ok":true}')
        elif p == "/focus":
            focus_kiosk()
            self._send(200, b'{"ok":true}')
        else:
            self._send(404)

    def log_message(self, *a):  # quiet
        pass


if __name__ == "__main__":
    threading.Thread(target=watch_playback, daemon=True).start()
    print(f"CycleScreen bridge on http://127.0.0.1:{PORT}  (launch: {LAUNCH_CMD})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
