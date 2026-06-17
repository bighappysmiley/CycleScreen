# 🚴 CycleScreen

A beautiful, Apple-style bike computer for a **Raspberry Pi + 7″ touchscreen**.
The dashboard is a full live map, with your profile, speed, weather, and four
quick-dial contacts on the side. It ships with an app drawer, a 24six-style
music player, a Friends app (voice notes, emoji, GPS challenges), light/dark
themes, and PIN-protected parental controls.

> Built as a self-contained web app — it runs in any modern browser today and
> in Chromium kiosk mode on the Pi. No build step, no dependencies to install.

## Features

- **First-run onboarding** — Apple-style **language picker** (English, Español, Français, Deutsch, עברית, العربية) + a **login / create-profile** screen with an optional passcode.
- **Dashboard** — full-screen map with a live, auto-following rider marker and breadcrumb trail, plus map overlays: a **clock + date** card, a **place search** bar (geocoded), and a large **speed gauge**.
- **Current Ride tracker** — Start/End a ride with a live **timer**, **distance**, **average speed**, and **heart-rate (BPM)**.
- **Bottom tab bar** — Home · Apps · Theme · Settings · Lock.
- **Left rail** — your name + presence, large **speed** readout, **weather** (live, from your GPS location), and **quick-dial contacts** (tap to call over your phone's Bluetooth, **hold to edit**).
- **App drawer** — springboard-style grid: 24six, Friends, Settings, Map, Weather, Fitness.
- **24six music** — opens the real [24six](https://24six.app) service (embedded, with a guaranteed "Open 24six ↗" launch fallback, since 24six has no public/embeddable API).
- **Quick-dial calling** — each contact dials via the platform's `tel:` handler (connected phone / cellular / VoIP softphone).
- **Friends** — add friends to your group, send **voice messages** and **emoji** reactions, and create **GPS challenges** (races / distance / climbs) with a live leaderboard.
- **Settings** — light/dark theme, accent color, profile, units (km/h ↔ mph), Bluetooth pairing, quick-dial editor.
- **Parental controls** — a 4-digit **parental PIN** (separate from the lock passcode) gates the restrictions: speed alert and Music / Friends app limits.
- **Security & anti-theft** — a separate **lock passcode** that locks the screen on demand (manual only — no auto-lock; stays locked across reboots), and a **GPS anti-theft alarm**: arm it, and if the bike is moved beyond a set distance (so wind/GPS drift won't false-trigger) it sounds a siren that can only be silenced with the lock passcode.

## Run it (any computer)

No server needed for most things, but the map tiles and weather need network,
so serve over HTTP:

```bash
cd CycleScreen
python3 -m http.server 8080
# open http://localhost:8080
```

The 7″ Pi screen is **800×480** — to preview that exact size, set your browser
window to 800×480 (or use device emulation).

## Hardware integration

Everything funnels through `js/device.js`, a hardware abstraction layer. With
no hardware attached it runs a **realistic simulation** (a moving GPS track,
live speed, weather). On the Pi it automatically uses real signals:

| Capability        | Real source on the Pi                                   | Fallback         |
|-------------------|---------------------------------------------------------|------------------|
| GPS (GLONASS)     | `navigator.geolocation` (via `gpsd` → `geoclue`)        | Simulated track  |
| Speed / heading   | GPS-derived                                             | Simulated        |
| Phone / quick dial| **Web Bluetooth** (`navigator.bluetooth`), HFP calling  | Simulated pairing|
| Weather           | Open-Meteo API at your live coordinates                 | Sensible default |
| Battery           | `navigator.getBattery()`                                | Simulated drain  |

### Google Maps

The map uses **OpenStreetMap (via Leaflet)** out of the box so it works with
zero setup. To switch to **Google Maps**, set a key before the scripts load:

```html
<script>window.CYCLESCREEN_GMAPS_KEY = "YOUR_KEY";</script>
```

(The pluggable hook lives in `js/map.js`.)

## Raspberry Pi kiosk setup

1. Flash Raspberry Pi OS, attach the official 7″ touchscreen and the GLONASS USB dongle.
2. Enable location via `gpsd` + `geoclue` so the browser's Geolocation API gets a real fix.
3. Copy this folder to the Pi and serve it (`python3 -m http.server 8080`).
4. Launch Chromium in kiosk mode on boot:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --app=http://localhost:8080 \
  --autoplay-policy=no-user-gesture-required
```

5. (Optional) Add that command to an autostart entry so CycleScreen boots straight into the dashboard.

## Project layout

```
index.html        # app shell + screen stack
css/              # design tokens + per-area styles (variables, base, components, dashboard, apps)
js/
  device.js       # hardware abstraction (GPS / Bluetooth / weather / battery) + simulation
  state.js        # persistent store (localStorage)
  map.js          # dashboard map (Leaflet/OSM, Google Maps optional)
  music.js        # 24six-style player
  friends.js      # friends, voice notes, emoji, GPS challenges
  settings.js     # appearance, profile, quick-dial, parental controls
  dashboard.js    # left rail (profile / speed / weather / quick-dial)
  app.js          # navigation, app drawer, status bar, sheets, theme, PIN lock
```

## Notes & next steps

This is a fully interactive **v1**. Things currently simulated that map to real
hardware later: actual audio streaming from the 24six API, Web Bluetooth HFP
call control, and real-time friend presence/challenge sync (would need a
backend or peer connection). The yoga app you mentioned at the end got cut off —
tell me what you'd like there and I'll add it.
