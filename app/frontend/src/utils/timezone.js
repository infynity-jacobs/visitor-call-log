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
