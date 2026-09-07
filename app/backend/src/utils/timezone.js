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

function formatIstDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return '';
  const date = String(dateValue).slice(0, 10);
  const time = String(timeValue).slice(0, 8);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hh, mm, ss || 0) + IST_OFFSET_MINUTES * 60000);
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())} ${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}`;
}

module.exports = { istNowParts, utcBoundsForIstDate, nextIstDate, formatIstDateTime };
