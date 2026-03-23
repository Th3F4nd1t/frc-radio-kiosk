'use strict';

const http = require('http');
const https = require('https');

const PUSH_TIMEOUT_MS = 10000;

/**
 * Build the payload expected by the VH113 AP and POST it.
 * @param {object} config - full application config from config.js
 * @returns {Promise<{statusCode: number, body: string}>}
 */
async function pushToAP(config) {
  const payload = {
    channel: config.channel,
    channelBandwidth: config.channelBandwidth,
    redVlans: config.redVlans,
    blueVlans: config.blueVlans,
    stationConfigurations: config.stationConfigurations
  };

  const postData = JSON.stringify(payload);
  let url;
  try {
    url = new URL(config.apUrl);
  } catch {
    throw new Error(`Invalid AP URL: ${config.apUrl}`);
  }

  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;
  const port = url.port ? parseInt(url.port, 10) : (isHttps ? 443 : 80);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port,
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body });
        } else {
          reject(new Error(`AP responded with HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.setTimeout(PUSH_TIMEOUT_MS, () => {
      req.destroy(new Error('Request to AP timed out'));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = { pushToAP };
