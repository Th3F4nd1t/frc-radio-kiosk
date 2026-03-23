/* ── FRC Radio Kiosk – VH109 page JS ──────────────────────────────────────
 * Handles: preset loading, VH109 network (HTTP) configuration
 * The VH109 is reached via a USB ethernet dongle connected to the radio.
 * ──────────────────────────────────────────────────────────────────────────── */
'use strict';

// ── Toast helper ──────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('status-toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 4000);
}

// ── Log helper ────────────────────────────────────────────────────────────────
function appendLog(text) {
  const box = document.getElementById('log-box');
  box.textContent += (box.textContent.endsWith('\n') ? '' : '\n') + text;
  box.scrollTop = box.scrollHeight;
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

// ── Load station preset from saved config ─────────────────────────────────────
async function loadPreset() {
  const station = document.getElementById('stationPreset').value;
  if (!station) {
    showToast('Select a station preset first.', 'info');
    return;
  }
  try {
    const cfg = await apiFetch('GET', '/api/config');
    const sc  = (cfg.stationConfigurations || {})[station];
    if (!sc) {
      showToast(`No saved configuration for ${station}.`, 'error');
      return;
    }
    document.getElementById('vh109Ssid').value   = sc.ssid   || '';
    document.getElementById('vh109WpaKey').value = sc.wpaKey || '';
    showToast(`Loaded preset for ${station}.`, 'ok');
  } catch (err) {
    showToast('Error loading preset: ' + err.message, 'error');
  }
}

// ── Generate WPA key ──────────────────────────────────────────────────────────
async function generateWpa() {
  try {
    const data = await apiFetch('POST', '/api/generate-wpa', { length: 16 });
    if (data.success) {
      document.getElementById('vh109WpaKey').value = data.key;
    } else {
      showToast('Key gen failed: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
  }
}

// ── Configure VH109 over HTTP ─────────────────────────────────────────────────
async function configureVH109() {
  const radioUrl     = document.getElementById('radioUrl').value.trim();
  const localAddress = document.getElementById('localAddress').value.trim();
  const ssid         = document.getElementById('vh109Ssid').value.trim();
  const wpaKey       = document.getElementById('vh109WpaKey').value.trim();

  if (!radioUrl) { showToast('Enter the radio configuration URL.', 'error'); return; }
  if (!ssid)     { showToast('Enter an SSID.', 'error'); return; }
  if (!wpaKey)   { showToast('Enter a WPA key.', 'error'); return; }

  const btn = document.getElementById('btn-configure');
  btn.disabled = true;
  showToast('⏳ Configuring VH109…', 'info');
  appendLog(`\n[${new Date().toLocaleTimeString()}] Configuring VH109`);
  appendLog(`  URL  : ${radioUrl}`);
  if (localAddress) appendLog(`  Bind : ${localAddress}`);
  appendLog(`  SSID : ${ssid}`);

  try {
    const body = { radioUrl, ssid, wpaKey };
    if (localAddress) body.localAddress = localAddress;

    const data = await apiFetch('POST', '/api/vh109/configure', body);
    if (data.success) {
      showToast('✅ ' + data.message, 'ok');
      appendLog(`[DONE] VH109 configured successfully.`);
    } else {
      showToast('❌ ' + data.error, 'error');
      appendLog(`[ERROR] ${data.error}`);
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
    appendLog(`[ERROR] ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

// ── Wire up events ────────────────────────────────────────────────────────────
document.getElementById('btn-load-preset').addEventListener('click', loadPreset);
document.getElementById('btn-gen-wpa').addEventListener('click', generateWpa);
document.getElementById('btn-configure').addEventListener('click', configureVH109);
document.getElementById('btn-clear-log').addEventListener('click', () => {
  document.getElementById('log-box').textContent = '';
});

