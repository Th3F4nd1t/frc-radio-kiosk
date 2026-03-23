#!/usr/bin/env bash
# scripts/install.sh
# One-time installation script for the FRC Radio Kiosk on a Raspberry Pi
# running Raspberry Pi OS (Bullseye / Bookworm).
#
# Usage (run as pi user with sudo access):
#   cd /home/pi/frc-radio-kiosk
#   bash scripts/install.sh

set -euo pipefail

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_USER="${SUDO_USER:-pi}"

echo "=== FRC Radio Kiosk Installer ==="
echo "Install directory : ${INSTALL_DIR}"
echo "Running as user   : ${SERVICE_USER}"
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
echo "[1/6] Installing system packages…"
apt-get update -q
apt-get install -y nodejs npm chromium-browser curl

# ── 2. Node.js dependencies ───────────────────────────────────────────────────
echo "[2/6] Installing Node.js dependencies…"
cd "${INSTALL_DIR}"
npm install --omit=dev

# ── 3. Data directory ─────────────────────────────────────────────────────────
echo "[3/6] Creating data directory…"
mkdir -p "${INSTALL_DIR}/data"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}/data"

# ── 4. Make scripts executable ───────────────────────────────────────────────
echo "[4/6] Setting script permissions…"
chmod +x "${INSTALL_DIR}/scripts/start-browser.sh"

# ── 5. Install systemd services ───────────────────────────────────────────────
echo "[5/6] Installing systemd services…"

# Replace placeholder paths in service files with the actual install dir
sed "s|/home/pi/frc-radio-kiosk|${INSTALL_DIR}|g" \
  "${INSTALL_DIR}/systemd/frc-radio-kiosk.service" \
  > /etc/systemd/system/frc-radio-kiosk.service

sed "s|/home/pi/frc-radio-kiosk|${INSTALL_DIR}|g" \
  "${INSTALL_DIR}/systemd/frc-radio-kiosk-browser.service" \
  > /etc/systemd/system/frc-radio-kiosk-browser.service

# Replace user placeholder with the actual user
sed -i "s|User=pi|User=${SERVICE_USER}|g" /etc/systemd/system/frc-radio-kiosk.service
sed -i "s|User=pi|User=${SERVICE_USER}|g" /etc/systemd/system/frc-radio-kiosk-browser.service

systemctl daemon-reload
systemctl enable frc-radio-kiosk.service
systemctl enable frc-radio-kiosk-browser.service

# ── 6. Start the server now ───────────────────────────────────────────────────
echo "[6/6] Starting FRC Radio Kiosk server…"
systemctl restart frc-radio-kiosk.service

echo ""
echo "=== Installation complete! ==="
echo ""
echo "The web server will start automatically on next boot."
echo "The kiosk browser will open automatically when the desktop starts."
echo ""
echo "To check server status : sudo systemctl status frc-radio-kiosk"
echo "To view server logs     : sudo journalctl -u frc-radio-kiosk -f"
echo "To open the UI manually : http://localhost:3000"
