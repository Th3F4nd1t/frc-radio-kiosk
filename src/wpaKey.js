'use strict';

const crypto = require('crypto');

// Printable ASCII characters safe for WPA-PSK passphrases (no spaces or quotes
// that could cause issues with various firmware implementations).
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#%^&*';

/**
 * Generate a cryptographically secure WPA-PSK passphrase.
 * WPA-PSK allows 8–63 printable ASCII characters.
 *
 * @param {number} [length=16] - desired key length (8–63)
 * @returns {string}
 */
function generateWpaKey(length = 16) {
  if (!Number.isInteger(length) || length < 8 || length > 63) {
    throw new RangeError('WPA key length must be an integer between 8 and 63');
  }

  // Use rejection sampling to avoid modulo bias
  const maxUsable = 256 - (256 % CHARSET.length);
  let key = '';
  while (key.length < length) {
    const bytes = crypto.randomBytes(length * 2); // over-generate to allow for rejection
    for (let i = 0; i < bytes.length && key.length < length; i++) {
      if (bytes[i] < maxUsable) {
        key += CHARSET[bytes[i] % CHARSET.length];
      }
    }
  }
  return key;
}

module.exports = { generateWpaKey };
