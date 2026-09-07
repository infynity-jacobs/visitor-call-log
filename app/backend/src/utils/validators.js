const { ValidationError } = require('../middleware/errorHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts digits, spaces, +, -, () — a permissive but useful phone check.
const PHONE_RE = /^[+()\-\s\d]{6,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

function requireString(value, field, { maxLen = 255, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw new ValidationError(`${field} is required.`);
  }
  const str = String(value).trim();
  if (str.length > maxLen) {
    throw new ValidationError(`${field} must be ${maxLen} characters or fewer.`);
  }
  return str;
}

function validatePhone(value, field = 'Phone', { optional = true } = {}) {
  if (!value) {
    if (optional) return null;
    throw new ValidationError(`${field} is required.`);
  }
  const str = String(value).trim();
  if (!PHONE_RE.test(str)) {
    throw new ValidationError(`${field} is not a valid phone number.`);
  }
  return str;
}

function validateEmail(value, field = 'Email', { optional = true } = {}) {
  if (!value) {
    if (optional) return null;
    throw new ValidationError(`${field} is required.`);
  }
  const str = String(value).trim();
  if (!EMAIL_RE.test(str)) {
    throw new ValidationError(`${field} is not a valid email address.`);
  }
  return str;
}

function validateDate(value, field = 'Date', { optional = true } = {}) {
  if (!value) {
    if (optional) return null;
    throw new ValidationError(`${field} is required.`);
  }
  if (!DATE_RE.test(value)) {
    throw new ValidationError(`${field} must be in YYYY-MM-DD format.`);
  }
  return value;
}

function validateTime(value, field = 'Time', { optional = true } = {}) {
  if (!value) {
    if (optional) return null;
    throw new ValidationError(`${field} is required.`);
  }
  if (!TIME_RE.test(value)) {
    throw new ValidationError(`${field} must be in HH:MM format.`);
  }
  return value;
}

module.exports = {
  requireString,
  validatePhone,
  validateEmail,
  validateDate,
  validateTime
};
