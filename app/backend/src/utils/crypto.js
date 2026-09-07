const crypto = require('crypto');
const config = require('../config');

// Derive a fixed-length key from the configured app secret so the operator
// can supply any string in APP_SECRET_KEY without worrying about byte length.
function deriveKey() {
  return crypto.createHash('sha256').update(String(config.appSecretKey)).digest();
}

const ALGO = 'aes-256-gcm';

function encrypt(plainText) {
  if (plainText === null || plainText === undefined || plainText === '') return null;
  const iv = crypto.randomBytes(12);
  const key = deriveKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store iv + authTag + ciphertext together, base64-encoded.
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(encoded) {
  if (!encoded) return null;
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
