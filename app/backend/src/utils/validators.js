const { ValidationError } = require('../middleware/errorHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\-\s\d]{6,20}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

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
  if (!PHONE_RE.test(str)) throw new ValidationError(`${field} is not a valid phone number.`);
  return str;
}

function validateEmail(value, field = 'Email', { optional = true } = {}) {
  if (!value) {
    if (optional) return null;
    throw new ValidationError(`${field} is required.`);
  }
  const str = String(value).trim();
  if (!EMAIL_RE.test(str)) throw new ValidationError(`${field} is not a valid email address.`);
  return str;
}

function validateDate(value, field = 'Date', { optional = true } = {}) {
  if (!value) {
    if (optional) return null;
    throw new ValidationError(`${field} is required.`);
  }
  const str = String(value).trim();
  const match = DATE_RE.exec(str);
  if (!match) throw new ValidationError(`${field} must be in YYYY-MM-DD format.`);
  const [, ys, ms, ds] = match;
  const year = Number(ys); const month = Number(ms); const day = Number(ds);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
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
  const match = TIME_RE.exec(str);
  if (!match) throw new ValidationError(`${field} must be in HH:MM or HH:MM:SS format.`);
  const hour = Number(match[1]); const minute = Number(match[2]); const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) throw new ValidationError(`${field} is not a valid time.`);
  return str;
}

function validatePositiveInt(value, field, { defaultValue, min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) throw new ValidationError(`${field} must be a positive integer.`);
  const n = Number(str);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new ValidationError(`${field} must be between ${min} and ${max}.`);
  return n;
}

function validateNonNegativeInt(value, field, { defaultValue = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) throw new ValidationError(`${field} must be a non-negative integer.`);
  const n = Number(str);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new ValidationError(`${field} must be between 0 and ${max}.`);
  return n;
}

function validateDateFilter({ mode = 'all', date, startDate, endDate } = {}) {
  if (!['all', 'single', 'range'].includes(mode)) {
    throw new ValidationError('Mode must be one of: all, single, range.');
  }
  if (mode === 'single') {
    if (!date) throw new ValidationError('Date is required when mode is single.');
    return { mode, date: validateDate(date, 'Date', { optional: false }) };
  }
  if (mode === 'range') {
    if (!startDate || !endDate) throw new ValidationError('Start date and end date are required when mode is range.');
    const start = validateDate(startDate, 'Start date', { optional: false });
    const end = validateDate(endDate, 'End date', { optional: false });
    if (start > end) throw new ValidationError('Start date cannot be later than end date.');
    return { mode, startDate: start, endDate: end };
  }
  if (date || startDate || endDate) throw new ValidationError('Date filters must be omitted when mode is all.');
  return { mode: 'all' };
}

module.exports = {
  requireString,
  validatePhone,
  validateEmail,
  validateDate,
  validateTime,
  validatePositiveInt,
  validateNonNegativeInt,
  validateDateFilter
};
