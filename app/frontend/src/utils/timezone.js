export function formatIstDateTime(dateValue, timeValue, options = {}) {
  if (!dateValue || !timeValue) return '';
  const rawDate = String(dateValue).slice(0, 10);
  const rawTime = String(timeValue).slice(0, 8);
  const iso = `${rawDate}T${rawTime}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `${rawDate} ${rawTime}`;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
    ...options
  }).format(date).replace(',', '');
}

export function formatIstDate(dateValue) {
  const value = formatIstDateTime(dateValue, '00:00:00');
  return value.slice(0, 10);
}

export function formatIstTime(dateValue, timeValue) {
  const value = formatIstDateTime(dateValue, timeValue);
  return value.slice(-8);
}


// Returns the current local date/time formatted for an HTML datetime-local input in IST.
export function currentIstDateTimeInput() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

// Converts an IST datetime-local value into the UTC clock date/time used by the
// existing database storage convention. The selected value is always treated as IST,
// regardless of the browser/server timezone.
export function istDateTimeInputToUtcParts(value) {
  if (!value) return { date: null, time: null };
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error('Invalid date and time.');
  const [, y, mo, d, h, mi, sec = '00'] = match;
  const instant = new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}+05:30`);
  if (Number.isNaN(instant.getTime())) throw new Error('Invalid date and time.');
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${instant.getUTCFullYear()}-${pad(instant.getUTCMonth() + 1)}-${pad(instant.getUTCDate())}`,
    time: `${pad(instant.getUTCHours())}:${pad(instant.getUTCMinutes())}:${pad(instant.getUTCSeconds())}`
  };
}
