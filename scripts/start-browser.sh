#!/usr/bin/env bash
# scripts/start-browser.sh
# Opens Chromium in kiosk mode pointing at the local FRC Radio Kiosk server.
# Called by frc-radio-kiosk-browser.service on the Raspberry Pi desktop.

set -euo pipefail

KIOSK_URL="http://localhost:3000"
CHROMIUM_FLAGS=(
  --kiosk
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-restore-session-state
  --no-first-run
  --check-for-update-interval=31536000
  --disable-translate
  --disable-features=TranslateUI
)

# Wait until the server is actually responding (up to 30 s)
MAX_WAIT=30
elapsed=0
echo "Waiting for FRC Radio Kiosk server to be ready…"
while ! curl -sf "${KIOSK_URL}/api/config" > /dev/null 2>&1; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "${elapsed}" -ge "${MAX_WAIT}" ]; then
    echo "Server not ready after ${MAX_WAIT}s – opening browser anyway."
    break
  fi
done

echo "Opening ${KIOSK_URL} in Chromium kiosk mode."
exec chromium-browser "${CHROMIUM_FLAGS[@]}" "${KIOSK_URL}"
