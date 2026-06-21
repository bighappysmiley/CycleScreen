#!/usr/bin/env bash
# CycleScreen Raspberry Pi installer.
# Installs packages, the GPS dongle bridge, the local-music helper, and a
# Chromium kiosk that boots into CycleScreen. Run on Raspberry Pi OS (desktop):
#   bash ~/CycleScreen/pi/setup.sh
set -e

USER_NAME="$(whoami)"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KIOSK_URL="${CYCLESCREEN_URL:-https://cyclescreen.netlify.app}"
GPS_DEVICE="${GPS_DEVICE:-/dev/ttyACM0}"

echo "==> CycleScreen setup (user=$USER_NAME, repo=$REPO_DIR, url=$KIOSK_URL)"

echo "==> 1/5 Installing packages…"
sudo apt update
sudo apt install -y chromium-browser python3 gpsd gpsd-clients bluez obexpushd unclutter

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

echo "==> 5/5 Kiosk autostart…"
AUTOSTART="$HOME/.config/lxsession/LXDE-pi"
mkdir -p "$AUTOSTART"
cat > "$AUTOSTART/autostart" <<EOF
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.5 -root
@chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito=false \
  --app=$KIOSK_URL \
  --autoplay-policy=no-user-gesture-required \
  --unsafely-treat-insecure-origin-as-secure=http://127.0.0.1:8780,http://127.0.0.1:8781 \
  --allow-running-insecure-content
EOF

echo ""
echo "==> Done. Check services:"
echo "    systemctl status cyclescreen-gps cyclescreen-music gpsd"
echo "    cgps -s          # confirm the dongle has a fix"
echo "==> Reboot to launch the kiosk:  sudo reboot"
