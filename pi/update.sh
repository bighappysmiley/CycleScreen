#!/usr/bin/env bash
# CycleScreen — one-shot updater for the Raspberry Pi 3A+ (Lite kiosk).
# Pulls the latest code, re-applies the kiosk setup (persistent login profile,
# no crash prompt, new on-screen keyboard, GPS fixes), clears caches, reboots.
#
#   bash ~/CycleScreen/pi/update.sh
set -e
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Pulling latest CycleScreen…"
git -C "$REPO_DIR" pull --ff-only

echo "==> Re-applying kiosk setup…"
GPS_DEVICE="${GPS_DEVICE:-/dev/ttyACM0}" bash "$REPO_DIR/pi/setup-lite.sh"

echo "==> Clearing Chromium cache…"
rm -rf /tmp/cs-cache

echo "==> Rebooting into the updated CycleScreen…"
sudo reboot
