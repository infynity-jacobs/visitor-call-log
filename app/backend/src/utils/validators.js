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
  const str = String(value).trim();
  if (!DATE_RE.test(str)) {
    throw new ValidationError(`${field} must be in YYYY-MM-DD format.`);
  }
  const [year, month, day] = str.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ValidationError(`${field} is not a valid calendar date.`);
  }
  return str;
}

function validateTime(value, field = 'Time', { optional = true } = {}) {
  if (!value) {
    if (optional) return null;
    throw new ValidationError(`${field} is required.`);
  }
  const str = String(value).trim();
  if (!TIME_RE.test(str)) {
    throw new ValidationError(`${field} must be in HH:MM or HH:MM:SS format.`);
  }
  const [hour, minute, second = 0] = str.split(':').map(Number);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new ValidationError(`${field} contains an invalid time.`);
  }
  return str;
}

function validatePagination(value, field, { defaultValue, min = 0, max = 1000 } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) throw new ValidationError(`${field} must be a non-negative integer.`);
  const number = Number(str);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}.`);
  }
  return number;
}

function validateDateFilter({ mode = 'all', date, startDate, endDate } = {}, fieldPrefix = 'Date') {
  if (!['all', 'single', 'range'].includes(mode)) {
    throw new ValidationError('Mode must be one of: all, single, range.');
  }
  if (mode === 'all') return { mode };
  if (mode === 'single') {
    return { mode, date: validateDate(date, fieldPrefix, { optional: false }) };
  }
  const start = validateDate(startDate, `Start ${fieldPrefix.toLowerCase()}`, { optional: false });
  const end = validateDate(endDate, `End ${fieldPrefix.toLowerCase()}`, { optional: false });
  if (start > end) throw new ValidationError('Start date cannot be later than end date.');
  return { mode, startDate: start, endDate: end };
}

module.exports = {
  requireString,
  validatePhone,
  validateEmail,
  validateDate,
  validateTime,
  validatePagination,
  validateDateFilter
};
