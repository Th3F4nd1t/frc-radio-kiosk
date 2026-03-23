'use strict';

/**
 * VH109 (Vivid-Hosting FRC radio) network configuration module.
 *
 * The VH109 is configured over HTTP, reached via a dedicated USB ethernet
 * dongle connected directly to the radio.  The Pi sends an HTTP POST to the
 * radio's configuration URL with the desired SSID and WPA key.
 *
 * Default radio URL : http://10.0.0.1/configuration
 * Default radio IP  : 10.0.0.1  (factory / unconfigured state)
 *
 * If your USB ethernet dongle has a different IP than the radio's subnet you
 * can pass `localAddress` to bind the outgoing request to the dongle's IP,
 * which ensures the request is routed through the correct interface.
 *
 * NOTE: The exact endpoint path and payload shape depend on the radio's
 * firmware version.  Adjust RADIO_PATH and buildPayload() below if needed.
 */

const http  = require('http');
const https = require('https');

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Build the JSON payload sent to the VH109.
 * @param {string} ssid
 * @param {string} wpaKey
 * @returns {object}
 */
function buildPayload(ssid, wpaKey) {
  return { ssid, wpaKey };
}

/**
 * POST configuration to a VH109 radio over HTTP.
 *
 * @param {object} opts
 * @param {string}  opts.radioUrl      - Full URL, e.g. "http://10.0.0.1/configuration"
 * @param {string}  opts.ssid          - Desired SSID (team number)
 * @param {string}  opts.wpaKey        - Desired WPA-PSK passphrase
 * @param {string} [opts.localAddress] - Local IP to bind to (the Pi's IP on the dongle interface)
 * @returns {Promise<{statusCode:number, body:string}>}
 */
async function configureVH109({ radioUrl, ssid, wpaKey, localAddress } = {}) {
  if (!radioUrl) throw new Error('radioUrl is required');
  if (!ssid)     throw new Error('ssid is required');
  if (!wpaKey)   throw new Error('wpaKey is required');

  let url;
  try {
    url = new URL(radioUrl);
  } catch {
    throw new Error(`Invalid radio URL: ${radioUrl}`);
  }

  const isHttps  = url.protocol === 'https:';
  const lib      = isHttps ? https : http;
  const port     = url.port ? parseInt(url.port, 10) : (isHttps ? 443 : 80);
  const postData = JSON.stringify(buildPayload(ssid, wpaKey));

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port,
      path:     url.pathname + (url.search || ''),
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    if (localAddress) options.localAddress = localAddress;

    const req = lib.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body });
        } else {
          reject(new Error(`Radio responded with HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Request to VH109 timed out'));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = { configureVH109, buildPayload };

