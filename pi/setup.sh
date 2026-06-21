#!/usr/bin/env bash
# CycleScreen Raspberry Pi installer.
# Installs packages, the GPS dongle bridge, the local-music helper, and a
# Chromium kiosk that boots into CycleScreen. Run on Raspberry Pi OS (desktop):
#   bash ~/CycleScreen/pi/setup.sh
set -e

USER_NAME="$(whoami)"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KIOSK_URL="${CYCLESCREEN_URL:-https://cyclescreenv2.netlify.app}"
GPS_DEVICE="${GPS_DEVICE:-/dev/ttyACM0}"

echo "==> CycleScreen setup (user=$USER_NAME, repo=$REPO_DIR, url=$KIOSK_URL)"

echo "==> 1/5 Installing packages…"
sudo apt update
sudo apt install -y chromium-browser python3 gpsd gpsd-clients bluez obexpushd unclutter xinput

echo "==> 2/5 Configuring gpsd for the dongle ($GPS_DEVICE)…"
sudo tee /etc/default/gpsd >/dev/null <<EOF
START_DAEMON="true"
USBAUTO="true"
DEVICES="$GPS_DEVICE"
GPSD_OPTIONS="-n"
EOF
sudo systemctl enable --now gpsd

echo "==> 3/5 Installing CycleScreen services (GPS bridge + local music)…"
mkdir -p "$HOME/Music"
for svc in cyclescreen-gps cyclescreen-music; do
  sed "s#/home/pi/CycleScreen#$REPO_DIR#; s/^User=pi/User=$USER_NAME/" \
    "$REPO_DIR/pi/$svc.service" | sudo tee "/etc/systemd/system/$svc.service" >/dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable --now cyclescreen-gps cyclescreen-music

echo "==> 4/5 Bluetooth file receiver (songs -> ~/Music)…"
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

echo "==> 5/6 More swap (the Pi 3A+ has only 512 MB RAM)…"
if [ -f /etc/dphys-swapfile ]; then
  sudo sed -i 's/^#\?CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
  sudo sed -i 's/^#\?CONF_MAXSWAP=.*/CONF_MAXSWAP=2048/' /etc/dphys-swapfile
  sudo systemctl restart dphys-swapfile || true
fi

echo "==> 6/6 Kiosk autostart (X11/LXDE, memory-friendly for 512 MB)…"
# A launch script + a desktop autostart entry (portable across LXDE sessions).
cat > "$HOME/cyclescreen-kiosk.sh" <<EOF
#!/bin/bash
xset s off; xset -dpms; xset s noblank
# apply a saved touchscreen calibration (Settings -> Admin -> Recalibrate)
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
exec chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \\
  --app=$KIOSK_URL \\
  --user-data-dir="\$PROFILE" \\
  --autoplay-policy=no-user-gesture-required \\
  --unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:8780,http://127.0.0.1:8781 \\
  --allow-running-insecure-content \\
  --process-per-site --disable-features=TranslateUI \\
  --disk-cache-dir=/tmp/cs-cache --disk-cache-size=15000000
EOF
chmod +x "$HOME/cyclescreen-kiosk.sh"

mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/cyclescreen.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=CycleScreen Kiosk
Exec=$HOME/cyclescreen-kiosk.sh
X-GNOME-Autostart-enabled=true
EOF

echo ""
echo "==> Done. Check services:"
echo "    systemctl status cyclescreen-gps cyclescreen-music gpsd"
echo "    cgps -s          # confirm the dongle has a fix"
echo "==> Reboot to launch the kiosk:  sudo reboot"
