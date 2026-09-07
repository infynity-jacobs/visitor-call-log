const IST_OFFSET_MINUTES = 330;

function pad(n) { return String(n).padStart(2, '0'); }

function istNowParts() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + IST_OFFSET_MINUTES * 60000);
  return {
    date: `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`,
    time: `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`
  };
}

function utcBoundsForIstDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MINUTES * 60000);
  return {
    date: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`,
    time: `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}:${pad(start.getUTCSeconds())}`
  };
}

function nextIstDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function extractDateParts(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()];
  }
  const text = String(value ?? '').trim();
  const match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return [parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate()];
  }
  return null;
}

function extractTimeParts(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds()];
  }
  const text = String(value ?? '').trim();
  const match = text.match(/(?:^|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/);
  if (match) return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
  return null;
}

function formatIstDateTime(dateValue, timeValue) {
  const dateParts = extractDateParts(dateValue);
  const timeParts = extractTimeParts(timeValue);
  if (!dateParts || !timeParts) return '';

  const [y, m, d] = dateParts;
  const [hh, mm, ss] = timeParts;
  if (![y, m, d, hh, mm, ss].every(Number.isFinite)) return '';

  // Stored values represent UTC clock values. Convert that clock value to IST.
  const ist = new Date(Date.UTC(y, m - 1, d, hh, mm, ss) + IST_OFFSET_MINUTES * 60000);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
}

module.exports = { istNowParts, utcBoundsForIstDate, nextIstDate, formatIstDateTime };
