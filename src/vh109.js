'use strict';

/**
 * VH109 (Vivid-Hosting FRC radio) USB serial configuration module.
 *
 * The VH109 exposes a UART console via its USB port (typically enumerated as
 * /dev/ttyUSBx or /dev/ttyACMx on Linux).  Configuration is applied via UCI
 * commands on the OpenWRT-based firmware.
 *
 * Baud rate: 115200 8N1 (default for VH109 / OM5P-AC class hardware).
 *
 * NOTE: If your specific firmware uses a different baud rate or command set,
 * adjust BAUD_RATE and buildCommands() below.
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const BAUD_RATE = 115200;
const COMMAND_DELAY_MS = 600;   // ms between successive commands
const TOTAL_TIMEOUT_MS = 30000; // bail out if the whole session takes > 30 s

/**
 * Return the list of available serial ports (all USB-serial adapters etc.).
 * @returns {Promise<Array<{path:string, manufacturer:string, productId:string, vendorId:string}>>}
 */
async function listPorts() {
  const ports = await SerialPort.list();
  return ports.map((p) => ({
    path:         p.path,
    manufacturer: p.manufacturer  || 'Unknown',
    productId:    p.productId     || '',
    vendorId:     p.vendorId      || '',
    serialNumber: p.serialNumber  || ''
  }));
}

/**
 * Build the UCI command sequence for the VH109.
 * @param {string} ssid
 * @param {string} wpaKey
 * @returns {string[]}
 */
function buildCommands(ssid, wpaKey) {
  // Sanitise – only allow printable ASCII, no single-quotes, no backslashes
  const safe = (s) => s.replace(/['"\\]/g, '');
  const sSsid   = safe(ssid);
  const sWpaKey = safe(wpaKey);

  return [
    `uci set wireless.@wifi-iface[0].ssid='${sSsid}'`,
    `uci set wireless.@wifi-iface[0].key='${sWpaKey}'`,
    `uci set wireless.@wifi-iface[0].encryption='psk2'`,
    'uci commit wireless',
    'wifi reload'
  ];
}

/**
 * Open a serial connection to a VH109, apply SSID + WPA key, and close.
 *
 * @param {string} portPath  - e.g. '/dev/ttyUSB0'
 * @param {string} ssid
 * @param {string} wpaKey
 * @returns {Promise<{success:boolean, log:string[]}>}
 */
async function configureVH109(portPath, ssid, wpaKey) {
  if (!portPath) throw new Error('portPath is required');
  if (!ssid)     throw new Error('ssid is required');
  if (!wpaKey)   throw new Error('wpaKey is required');

  return new Promise((resolve, reject) => {
    const log = [];

    const port = new SerialPort({ path: portPath, baudRate: BAUD_RATE, autoOpen: false });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    let timer = null;

    const done = (err) => {
      if (timer) clearTimeout(timer);
      if (port.isOpen) {
        port.close(() => {
          if (err) reject(err); else resolve({ success: true, log });
        });
      } else {
        if (err) reject(err); else resolve({ success: true, log });
      }
    };

    timer = setTimeout(() => done(new Error('Configuration timed out')), TOTAL_TIMEOUT_MS);

    parser.on('data', (line) => log.push(line.trim()));
    port.on('error', (err) => done(err));

    port.open((openErr) => {
      if (openErr) {
        done(new Error(`Cannot open ${portPath}: ${openErr.message}`));
        return;
      }

      const commands = buildCommands(ssid, wpaKey);
      let idx = 0;

      // Give the console a moment to be ready before sending commands
      const sendNext = () => {
        if (idx >= commands.length) {
          // Wait for the last command's output then finish
          setTimeout(() => done(null), COMMAND_DELAY_MS * 2);
          return;
        }
        const cmd = commands[idx++];
        log.push(`> ${cmd}`);
        port.write(`${cmd}\n`, (writeErr) => {
          if (writeErr) { done(new Error(`Write failed: ${writeErr.message}`)); return; }
          setTimeout(sendNext, COMMAND_DELAY_MS);
        });
      };

      setTimeout(sendNext, 1000);
    });
  });
}

module.exports = { listPorts, configureVH109, buildCommands };
