'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../data/config.json');

const DEFAULT_CONFIG = {
  apUrl: 'http://10.0.100.2/configuration',
  channel: 37,
  channelBandwidth: '40MHz',
  redVlans: '10_20_30',
  blueVlans: '40_50_60',
  autoPushOnStartup: true,
  stationConfigurations: {
    red1:  { ssid: '', wpaKey: '' },
    red2:  { ssid: '', wpaKey: '' },
    red3:  { ssid: '', wpaKey: '' },
    blue1: { ssid: '', wpaKey: '' },
    blue2: { ssid: '', wpaKey: '' },
    blue3: { ssid: '', wpaKey: '' }
  }
};

function ensureDataDir() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return structuredClone(DEFAULT_CONFIG);
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const saved = JSON.parse(raw);
    // Deep-merge with defaults so new fields are always present
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      stationConfigurations: {
        ...DEFAULT_CONFIG.stationConfigurations,
        ...saved.stationConfigurations
      }
    };
  } catch (err) {
    console.error('[config] Error reading config, using defaults:', err.message);
    return structuredClone(DEFAULT_CONFIG);
  }
}

function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = { loadConfig, saveConfig, DEFAULT_CONFIG };
