#!/usr/bin/env bash
# CycleScreen — Raspberry Pi OS LITE kiosk installer (fastest, no desktop).
# Boots to console, auto-logs in, and starts a minimal X session running ONLY
# Chromium in kiosk mode — no desktop/panel/window-manager overhead. Best for
# the 512 MB Pi 3A+. Run on a fresh Raspberry Pi OS Lite (64-bit):
#   bash ~/CycleScreen/pi/setup-lite.sh
set -e

USER_NAME="$(whoami)"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KIOSK_URL="${CYCLESCREEN_URL:-https://cyclescreenv2.netlify.app}"
GPS_DEVICE="${GPS_DEVICE:-/dev/ttyACM0}"
# Chromium binary differs across images (chromium-browser vs chromium)
CHROME="$(command -v chromium-browser || command -v chromium || echo chromium-browser)"

echo "==> CycleScreen LITE kiosk setup (user=$USER_NAME, url=$KIOSK_URL)"

echo "==> 1/7 Installing minimal X + Chromium + helpers…"
sudo apt update
sudo apt install -y --no-install-recommends \
  xserver-xorg xinit xserver-xorg-legacy x11-xserver-utils \
  chromium-browser unclutter xinput fonts-noto-color-emoji \
  python3 gpsd gpsd-clients bluez obexpushd
CHROME="$(command -v chromium-browser || command -v chromium || echo chromium-browser)"
# allow startx from the console as a normal user
printf 'allowed_users=anybody\nneeds_root_rights=yes\n' | sudo tee /etc/X11/Xwrapper.config >/dev/null

echo "==> 2/7 gpsd for the dongle ($GPS_DEVICE)…"
sudo tee /etc/default/gpsd >/dev/null <<EOF
START_DAEMON="true"
USBAUTO="true"
DEVICES="$GPS_DEVICE"
GPSD_OPTIONS="-n"
EOF
sudo systemctl enable --now gpsd

echo "==> 3/7 GPS bridge + local-music services…"
mkdir -p "$HOME/Music"
for svc in cyclescreen-gps cyclescreen-music; do
  sed "s#/home/pi/CycleScreen#$REPO_DIR#; s/^User=pi/User=$USER_NAME/" \
    "$REPO_DIR/pi/$svc.service" | sudo tee "/etc/systemd/system/$svc.service" >/dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable --now cyclescreen-gps cyclescreen-music

echo "==> 4/7 Bluetooth song receiver (-> ~/Music)…"
sudo tee /etc/systemd/system/obexpush.service >/dev/null <<EOF
[Unit]
Description=Bluetooth OBEX push receiver
After=bluetooth.service
[Service]
User=$USER_NAME
ExecStart=/usr/bin/obexpushd -B -o $HOME/Music -n
Restart=always
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now obexpush || true

echo "==> 5/7 Swap 1 GB (512 MB RAM)…"
if [ -f /etc/dphys-swapfile ]; then
  sudo sed -i 's/^#\?CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
  sudo systemctl restart dphys-swapfile || true
fi

echo "==> 6/7 Console auto-login…"
sudo raspi-config nonint do_boot_behaviour B2   # boot to console, auto-login

echo "==> 7/7 Kiosk X session (xinit, no desktop)…"
cat > "$HOME/.xinitrc" <<EOF
#!/bin/sh
xset s off; xset -dpms; xset s noblank
# apply a saved touchscreen calibration (from Settings -> Admin -> Recalibrate)
if [ -f "\$HOME/.config/cyclescreen/touch-matrix" ]; then
  M=\$(cat "\$HOME/.config/cyclescreen/touch-matrix")
  DEV=\$(xinput list --name-only | grep -i touch | head -1)
  [ -n "\$DEV" ] && xinput set-prop "\$DEV" "Coordinate Transformation Matrix" \$M
fi
# Persistent Chromium profile so the login + language survive reboots, and clear
# the crash flag so pulling power never shows a "Restore pages"/"didn't shut down
# correctly" prompt on next boot.
PROFILE="\$HOME/.config/cyclescreen-chrome"
mkdir -p "\$PROFILE/Default"
[ -f "\$PROFILE/Default/Preferences" ] && sed -i \\
  's/"exit_type":"[^"]*"/"exit_type":"Normal"/; s/"exited_cleanly":false/"exited_cleanly":true/' \\
  "\$PROFILE/Default/Preferences"
unclutter -idle 0.5 -root &
exec $CHROME --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
  --app=$KIOSK_URL \\
  --user-data-dir="\$PROFILE" \\
  --autoplay-policy=no-user-gesture-required \\
  --unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:8780,http://127.0.0.1:8781 \\
  --allow-running-insecure-content \\
  --process-per-site --disable-features=TranslateUI \\
  --disk-cache-dir=/tmp/cs-cache --disk-cache-size=15000000
EOF
chmod +x "$HOME/.xinitrc"

# auto-start X on tty1 login
touch "$HOME/.bash_profile"
grep -q "CycleScreen kiosk" "$HOME/.bash_profile" || cat >> "$HOME/.bash_profile" <<'EOF'

# CycleScreen kiosk: start X (and Chromium) automatically on the console
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx -- -nocursor >/dev/null 2>&1
fi
EOF

echo ""
echo "==> Done. Verify, then reboot:"
echo "    cgps -s                                  # GPS fix (needs sky view)"
echo "    curl -s http://127.0.0.1:8781/position   # your lat/lng"
echo "    sudo reboot                              # boots straight into CycleScreen"
