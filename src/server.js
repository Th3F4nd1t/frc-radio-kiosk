'use strict';

const express  = require('express');
const path     = require('path');

const { loadConfig, saveConfig }    = require('./config');
const { pushToAP }                   = require('./apConfig');
const { generateWpaKey }             = require('./wpaKey');
const { configureVH109 }  = require('./vh109');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── API: Configuration ────────────────────────────────────────────────────────

/** GET current persisted configuration */
app.get('/api/config', (_req, res) => {
  res.json(loadConfig());
});

/** POST save (persist) configuration */
app.post('/api/config', (req, res) => {
  try {
    const incoming = req.body;
    if (typeof incoming !== 'object' || incoming === null) {
      return res.status(400).json({ success: false, error: 'Request body must be a JSON object' });
    }

    // Only allow known top-level keys
    const allowed = ['apUrl', 'channel', 'channelBandwidth', 'redVlans', 'blueVlans',
                     'autoPushOnStartup', 'stationConfigurations'];
    const config = loadConfig();
    for (const key of allowed) {
      if (key in incoming) config[key] = incoming[key];
    }

    saveConfig(config);
    res.json({ success: true, message: 'Configuration saved.' });
  } catch (err) {
    console.error('[POST /api/config]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/** POST push current config to the VH113 AP */
app.post('/api/push', async (_req, res) => {
  try {
    const config = loadConfig();
    const result = await pushToAP(config);
    res.json({ success: true, message: 'Configuration pushed to AP.', result });
  } catch (err) {
    console.error('[POST /api/push]', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

/** POST save config then push to AP in one step */
app.post('/api/save-and-push', async (req, res) => {
  const incoming = req.body;
  if (typeof incoming !== 'object' || incoming === null) {
    return res.status(400).json({ success: false, saved: false, error: 'Request body must be a JSON object' });
  }

  // Always persist first
  let config;
  try {
    const allowed = ['apUrl', 'channel', 'channelBandwidth', 'redVlans', 'blueVlans',
                     'autoPushOnStartup', 'stationConfigurations'];
    config = loadConfig();
    for (const key of allowed) {
      if (key in incoming) config[key] = incoming[key];
    }
    saveConfig(config);
  } catch (saveErr) {
    console.error('[POST /api/save-and-push] save failed:', saveErr.message);
    return res.status(500).json({ success: false, saved: false, error: saveErr.message });
  }

  // Then push – failure here doesn't undo the save
  try {
    const result = await pushToAP(config);
    res.json({ success: true, saved: true, message: 'Configuration saved and pushed to AP.', result });
  } catch (pushErr) {
    console.error('[POST /api/save-and-push] push failed:', pushErr.message);
    res.status(502).json({
      success: false,
      saved: true,
      message: 'Configuration saved locally, but push to AP failed.',
      error: pushErr.message
    });
  }
});

// ── API: WPA Key Generator ────────────────────────────────────────────────────

/** POST generate a random WPA-PSK key */
app.post('/api/generate-wpa', (req, res) => {
  try {
    const length = parseInt(req.body && req.body.length, 10) || 16;
    const key = generateWpaKey(length);
    res.json({ success: true, key });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ── API: VH109 Network Configuration ─────────────────────────────────────────

/** POST configure a VH109 over its HTTP API via the USB ethernet dongle */
app.post('/api/vh109/configure', async (req, res) => {
  try {
    const { radioUrl, ssid, wpaKey, localAddress } = req.body || {};
    if (!radioUrl) return res.status(400).json({ success: false, error: '`radioUrl` is required' });
    if (!ssid)     return res.status(400).json({ success: false, error: '`ssid` is required' });
    if (!wpaKey)   return res.status(400).json({ success: false, error: '`wpaKey` is required' });

    const result = await configureVH109({ radioUrl, ssid, wpaKey, localAddress: localAddress || undefined });
    res.json({ success: true, message: 'VH109 configured successfully.', result });
  } catch (err) {
    console.error('[POST /api/vh109/configure]', err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

// ── Startup: auto-push saved config to AP ────────────────────────────────────

async function startupPush(config, attempt = 1, maxAttempts = 5) {
  try {
    console.log(`[startup] Pushing config to AP (attempt ${attempt}/${maxAttempts})…`);
    await pushToAP(config);
    console.log('[startup] Config pushed to AP successfully.');
  } catch (err) {
    console.warn(`[startup] Push failed: ${err.message}`);
    if (attempt < maxAttempts) {
      const delay = attempt * 5000;
      console.log(`[startup] Retrying in ${delay / 1000}s…`);
      setTimeout(() => startupPush(config, attempt + 1, maxAttempts), delay);
    } else {
      console.error('[startup] All push attempts exhausted. Continue without AP sync.');
    }
  }
}

// ── Start server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`FRC Radio Kiosk server listening on http://localhost:${PORT}`);

  const config = loadConfig();
  if (config.autoPushOnStartup) {
    // Delay first attempt slightly to let the network settle after boot
    setTimeout(() => startupPush(config), 3000);
  }
});

module.exports = app; // export for testing
