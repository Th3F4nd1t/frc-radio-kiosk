/* ── FRC Radio Kiosk – VH109 page JS ──────────────────────────────────────
 * Handles: port discovery, preset loading, VH109 serial configuration
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

// ── Refresh serial ports ──────────────────────────────────────────────────────
async function refreshPorts() {
  const sel = document.getElementById('portSelect');
  sel.innerHTML = '<option value="">— detecting… —</option>';
  try {
    const data = await apiFetch('GET', '/api/vh109/ports');
    sel.innerHTML = '';
    if (data.success && data.ports.length > 0) {
      data.ports.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.path;
        opt.textContent = `${p.path}  ${p.manufacturer !== 'Unknown' ? '– ' + p.manufacturer : ''}`.trim();
        sel.appendChild(opt);
      });
    } else {
      sel.innerHTML = '<option value="">— no serial ports found —</option>';
      showToast('No serial ports detected. Check the USB connection.', 'error');
    }
  } catch (err) {
    sel.innerHTML = '<option value="">— error detecting ports —</option>';
    showToast('Error listing ports: ' + err.message, 'error');
  }
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

// ── Configure VH109 ───────────────────────────────────────────────────────────
async function configureVH109() {
  const port   = document.getElementById('portSelect').value;
  const ssid   = document.getElementById('vh109Ssid').value.trim();
  const wpaKey = document.getElementById('vh109WpaKey').value.trim();

  if (!port)   { showToast('Select a serial port.', 'error'); return; }
  if (!ssid)   { showToast('Enter an SSID.', 'error'); return; }
  if (!wpaKey) { showToast('Enter a WPA key.', 'error'); return; }

  const btn = document.getElementById('btn-configure');
  btn.disabled = true;
  showToast('⏳ Configuring VH109…', 'info');
  appendLog(`\n[${new Date().toLocaleTimeString()}] Configuring VH109 on ${port} — SSID: ${ssid}`);

  try {
    const data = await apiFetch('POST', '/api/vh109/configure', { port, ssid, wpaKey });
    if (data.success) {
      (data.log || []).forEach((line) => appendLog(line));
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
document.getElementById('btn-refresh-ports').addEventListener('click', refreshPorts);
document.getElementById('btn-load-preset').addEventListener('click', loadPreset);
document.getElementById('btn-gen-wpa').addEventListener('click', generateWpa);
document.getElementById('btn-configure').addEventListener('click', configureVH109);
document.getElementById('btn-clear-log').addEventListener('click', () => {
  document.getElementById('log-box').textContent = '';
});

// ── Init: auto-refresh ports on page load ─────────────────────────────────────
refreshPorts();
