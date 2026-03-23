/* ── FRC Radio Kiosk – main page JS ────────────────────────────────────────
 * Handles: load config on page-open, save, push, save-and-push, WPA generation
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

// ── Station helpers ───────────────────────────────────────────────────────────
const STATIONS = ['red1','red2','red3','blue1','blue2','blue3'];

function getStationCard(station) {
  return document.querySelector(`.station-card[data-station="${station}"]`);
}

function getStationValues() {
  const result = {};
  for (const s of STATIONS) {
    const card = getStationCard(s);
    result[s] = {
      ssid:   card.querySelector('.ssid-input').value.trim(),
      wpaKey: card.querySelector('.wpa-input').value.trim()
    };
  }
  return result;
}

function setStationValues(stationConfigurations) {
  for (const s of STATIONS) {
    const sc = stationConfigurations[s] || {};
    const card = getStationCard(s);
    card.querySelector('.ssid-input').value  = sc.ssid   || '';
    card.querySelector('.wpa-input').value   = sc.wpaKey || '';
  }
}

// ── Collect form → config object ──────────────────────────────────────────────
function collectConfig() {
  return {
    apUrl:               document.getElementById('apUrl').value.trim(),
    channel:             parseInt(document.getElementById('channel').value, 10),
    channelBandwidth:    document.getElementById('channelBandwidth').value,
    redVlans:            document.getElementById('redVlans').value.trim(),
    blueVlans:           document.getElementById('blueVlans').value.trim(),
    autoPushOnStartup:   document.getElementById('autoPushOnStartup').checked,
    stationConfigurations: getStationValues()
  };
}

// ── Populate form from config object ─────────────────────────────────────────
function populateForm(cfg) {
  document.getElementById('apUrl').value           = cfg.apUrl            || 'http://10.0.100.2/configuration';
  document.getElementById('channel').value         = String(cfg.channel   || 37);
  document.getElementById('channelBandwidth').value= cfg.channelBandwidth || '40MHz';
  document.getElementById('redVlans').value        = cfg.redVlans         || '10_20_30';
  document.getElementById('blueVlans').value       = cfg.blueVlans        || '40_50_60';
  document.getElementById('autoPushOnStartup').checked = !!cfg.autoPushOnStartup;
  setStationValues(cfg.stationConfigurations || {});
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

// ── Generate WPA key for a station card ──────────────────────────────────────
async function generateWpa(card) {
  try {
    const data = await apiFetch('POST', '/api/generate-wpa', { length: 16 });
    if (data.success) {
      card.querySelector('.wpa-input').value = data.key;
    } else {
      showToast('Failed to generate key: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
  }
}

// ── Load config on page load ──────────────────────────────────────────────────
async function loadConfig() {
  try {
    const cfg = await apiFetch('GET', '/api/config');
    populateForm(cfg);
  } catch (err) {
    showToast('Could not load configuration: ' + err.message, 'error');
  }
}

// ── Button: Save ──────────────────────────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', async () => {
  try {
    const data = await apiFetch('POST', '/api/config', collectConfig());
    if (data.success) {
      showToast('✅ ' + data.message, 'ok');
    } else {
      showToast('❌ ' + data.error, 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  }
});

// ── Button: Push to AP ────────────────────────────────────────────────────────
document.getElementById('btn-push').addEventListener('click', async () => {
  showToast('⏳ Pushing to AP…', 'info');
  try {
    const data = await apiFetch('POST', '/api/push');
    if (data.success) {
      showToast('✅ ' + data.message, 'ok');
    } else {
      showToast('❌ ' + data.error, 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  }
});

// ── Button: Save & Push ───────────────────────────────────────────────────────
document.getElementById('btn-save-push').addEventListener('click', async () => {
  showToast('⏳ Saving and pushing…', 'info');
  try {
    const data = await apiFetch('POST', '/api/save-and-push', collectConfig());
    if (data.success) {
      showToast('✅ ' + data.message, 'ok');
    } else if (data.saved) {
      // Config saved locally but AP push failed
      showToast('⚠️ Saved locally. AP push failed: ' + data.error, 'error');
    } else {
      showToast('❌ ' + data.error, 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  }
});

// ── Wire up per-station generate buttons ──────────────────────────────────────
document.querySelectorAll('.gen-btn').forEach((btn) => {
  const card = btn.closest('.station-card');
  btn.addEventListener('click', () => generateWpa(card));
});

// ── Init ──────────────────────────────────────────────────────────────────────
loadConfig();
