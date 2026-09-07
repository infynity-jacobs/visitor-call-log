const TOKEN_KEY = 'vcl_token';
const USER_KEY = 'vcl_user';

function getToken() {
  return window.sessionStorage.getItem(TOKEN_KEY);
}

function setSession(token, user) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(USER_KEY);
}

function getUser() {
  const raw = window.sessionStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (raw) return res; // caller handles blob download

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function downloadReport(type, format, params) {
  const query = new URLSearchParams(params).toString();
  const res = await request(`/reports/${type}/${format}?${query}`, { raw: true });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to generate report.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-report.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function uploadJson(path, payload) { return request(path, { method: 'POST', body: payload }); }

export const api = { request, downloadReport, uploadJson, getToken, setSession, clearSession, getUser };
