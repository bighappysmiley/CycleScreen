# CycleScreen — Raspberry Pi setup (step by step)

End result: the Pi boots straight into CycleScreen full-screen, with the real
GPS dongle, Bluetooth song transfer, and (optional) phone calling working.

## What you need
- Raspberry Pi 4 (or 5), microSD card (16 GB+), power supply
- Official Raspberry Pi 7″ touchscreen (800×480)
- GLONASS/GPS USB dongle, USB speaker, USB mic
- A computer with **Raspberry Pi Imager** (raspberrypi.com/software)

---

## 1. Flash the SD card
1. Open **Raspberry Pi Imager** on your computer.
2. **Choose Device:** your Pi model. **Choose OS:** *Raspberry Pi OS (64-bit)* (the full desktop version).
3. **Choose Storage:** your SD card.
4. Click the **gear / Edit Settings** before writing and set:
   - Hostname: `cyclescreen`
   - **Enable SSH** (password auth)
   - Username `pi` + a password you'll remember
   - Wi-Fi SSID + password + your country
   - Locale / timezone
5. **Write**, then put the card in the Pi.

## 2. First boot
1. Connect the 7″ screen (ribbon to DISPLAY + the two power jumper wires), plug in the GPS dongle, speaker, and mic, then power on.
2. It boots to the desktop. Connect to Wi-Fi if you didn't preset it.
3. Open a terminal (or SSH in from your computer: `ssh pi@cyclescreen.local`).

## 3. Find your GPS dongle's port
```bash
ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
```
Usually `/dev/ttyACM0` (sometimes `/dev/ttyUSB0`). Note it.

## 4. Run the installer (one command)
```bash
git clone https://github.com/bighappysmiley/cyclescreen.git ~/CycleScreen
# if your dongle isn't /dev/ttyACM0, pass it:
GPS_DEVICE=/dev/ttyACM0 bash ~/CycleScreen/pi/setup.sh
```
This installs everything and sets up:
- **gpsd** reading the dongle
- **cyclescreen-gps** — feeds the dongle position to the app (Chromium can't read gpsd directly)
- **cyclescreen-music** — serves your music folder
- **obexpush** — receives songs sent over Bluetooth into `~/Music`
- **Chromium kiosk** autostart pointing at `https://cyclescreen.netlify.app`

> Using a different URL (e.g. your own deploy or a locally-served copy)?
> Run it as `CYCLESCREEN_URL=https://your-url bash ~/CycleScreen/pi/setup.sh`.

## 5. Verify, then reboot
```bash
cgps -s                                   # should show a GPS fix (go near a window/outside)
systemctl status cyclescreen-gps cyclescreen-music
curl -s http://127.0.0.1:8781/position    # should show your lat/lng once gpsd has a fix
sudo reboot
```
After reboot the Pi launches CycleScreen full-screen.

## 6. First run in the app
1. **Sign in once** (create your account) — it stays signed in after that.
2. Settings → **Profile**: add a photo (crop it), set your name.
3. Settings → **Quick Dial**: add up to 3 contacts.
4. Optional: set a **Lock Passcode** and turn on **Anti-Theft Alarm** (only active while you lock the screen).
5. The status bar GPS chip should show a satellite count (not `…`). If it shows `SET`, you're on a manual pin — clear it in Settings → Location → "Use GPS".

---

## Transferring music over Bluetooth
1. On the Pi: `bluetoothctl` → `power on` → `discoverable on` → `pairable on`, then pair your phone.
2. From your phone, **share/Send via Bluetooth** the song files to the Pi.
3. They land in `~/Music` and appear automatically in **Music → Local**.

## Optional: phone calling (quick dial)
Quick-dial fires a `tel:` link. To make it ring through a paired phone, install an
HFP handler and register it for `tel:` — e.g. `ofono` + `gnome-calls`, then
`xdg-mime default <handler>.desktop x-scheme-handler/tel`.

## Troubleshooting
- **GPS chip stuck on `…`:** dongle needs sky view; check `cgps -s`. Confirm
  `DEVICES` in `/etc/default/gpsd` matches your port, then `sudo systemctl restart gpsd cyclescreen-gps`.
- **Sign-in error `unauthorized-domain`:** add your kiosk URL in Firebase →
  Authentication → Settings → Authorized domains.
- **No location at all:** `curl http://127.0.0.1:8781/position` — if it returns
  `{"lat":null}`, gpsd has no fix yet; if it refuses to connect, the
  `cyclescreen-gps` service isn't running (`journalctl -u cyclescreen-gps`).
- **Screen blanks / sleeps:** the installer disables blanking via `xset`; if it
  still sleeps, check the autostart file in `~/.config/lxsession/LXDE-pi/autostart`.
