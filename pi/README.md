# CycleScreen Pi bridge — native 24six integration

24six is a closed, login-protected app that can't run logged-in inside a web
frame. So on the Pi you run the **native 24six app** and this small bridge
connects it to the CycleScreen kiosk: CycleScreen shows live **Now Playing**,
sends **play/pause/next**, **launches** 24six, and the bridge **auto-returns to
CycleScreen** when a song starts.

```
 native 24six app ──MPRIS──▶ cyclescreen-bridge.py ──localhost HTTP──▶ CycleScreen (Chromium kiosk)
```

## 1. Install dependencies

```bash
sudo apt update
sudo apt install playerctl wmctrl xdotool python3
```

## 2. Get the native 24six app running

- **Android app via Waydroid** (recommended on Pi): install [Waydroid](https://waydro.id/),
  then install 24six (`app.tfs.music`) and sign in once. Launch command:
  `waydroid app launch app.tfs.music`.
- **Or** any desktop build of 24six — set `CYCLESCREEN_24SIX_LAUNCH` to its command.

The app must expose MPRIS (most Android/Linux players do). Verify with:

```bash
playerctl metadata
```

## 3. Run the bridge

```bash
python3 ~/CycleScreen/pi/cyclescreen-bridge.py
# CycleScreen bridge on http://127.0.0.1:8765
```

Install it as a service so it starts with the kiosk:

```bash
sudo cp ~/CycleScreen/pi/cyclescreen-bridge.service /etc/systemd/system/
sudo systemctl enable --now cyclescreen-bridge
```

## 4. Point CycleScreen at the bridge

In CycleScreen → **Settings → Connectivity → 24six Bridge**, set the URL
(default `http://127.0.0.1:8765`). The Music app then shows the native player.

## 5. Kiosk flag for localhost (important)

CycleScreen is served over HTTPS, so the browser blocks calls to the
`http://127.0.0.1` bridge as "mixed content". Allow it in the kiosk launch:

```bash
chromium-browser --kiosk \
  --unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:8765 \
  --allow-running-insecure-content \
  --autoplay-policy=no-user-gesture-required \
  --app=https://<your-cyclescreen-url>
```

## How the UX flows

1. Tap **24six** (or the Now Playing pill) → **Open 24six app** launches the native app.
2. Pick a song. When it starts playing, the bridge brings **CycleScreen** back to
   the front automatically.
3. The dashboard shows the **Now Playing** pill; the Music screen shows full
   art + title/artist + **‹‹ / play-pause / ››** controls (sent over MPRIS).

## Config (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `CYCLESCREEN_PORT` | `8765` | bridge port |
| `CYCLESCREEN_24SIX_LAUNCH` | `waydroid app launch app.tfs.music` | how to open 24six |
| `CYCLESCREEN_KIOSK_MATCH` | `chromium` | window to refocus on playback |
