const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { query } = require('../db/pool');
const { encrypt, decrypt } = require('../utils/crypto');

function getConfig(dbRow) {
  if (!dbRow) return null;
  return {
    ...dbRow,
    api_password: dbRow.api_password_enc ? decrypt(dbRow.api_password_enc) : '',
  };
}

async function loadConfig() {
  const result = await query('SELECT * FROM s50_cdr_settings WHERE id = 1');
  return getConfig(result.rows[0]);
}

function baseUrl(cfg) {
  return `${cfg.api_protocol}://${cfg.server}:${cfg.api_port}/api/v${cfg.api_version}`;
}

function requestJson(cfg, path, payload = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl(cfg)}${path}`);
    const body = Buffer.from(JSON.stringify(payload));
    const transport = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: Number(url.port),
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        Host: url.host,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
        'Content-Length': body.length,
        'User-Agent': 'Visitor-Call-Log-S50/1.3.0',
      },
      timeout: 15000,
      rejectUnauthorized: !!cfg.verify_tls,
    };
    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch (_) {}
        if (res.statusCode >= 400) return reject(new Error(data.error || `Yeastar API returned HTTP ${res.statusCode}.`));
        resolve(data);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Yeastar API request timed out.')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function requestBinary(cfg, absoluteUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(absoluteUrl);
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.get({
      hostname: url.hostname,
      port: Number(url.port),
      path: `${url.pathname}${url.search}`,
      headers: { Host: url.host, Accept: 'application/octet-stream', 'User-Agent': 'Visitor-Call-Log-S50/1.3.0' },
      timeout: 20000,
      rejectUnauthorized: !!cfg.verify_tls,
    }, (res) => {
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`Yeastar recording download returned HTTP ${res.statusCode}.`));
      }
      const max = 25 * 1024 * 1024;
      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > max) req.destroy(new Error('Recording exceeds the permitted 25 MB limit.'));
        else chunks.push(chunk);
      });
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'audio/wav' }));
    });
    req.on('timeout', () => req.destroy(new Error('Yeastar recording download timed out.')));
    req.on('error', reject);
  });
}

async function login(cfg) {
  if (!cfg?.server || !cfg.api_username || !cfg.api_password) throw new Error('S50 API credentials are not configured.');
  const md5 = crypto.createHash('md5').update(cfg.api_password).digest('hex');
  const response = await requestJson(cfg, '/login', {
    username: cfg.api_username,
    password: md5,
    version: cfg.api_version,
    port: '8260',
  });
  if (String(response.status || '').toLowerCase() !== 'success' || !response.token) {
    throw new Error(`S50 API login failed${response.errno ? ` (error ${response.errno})` : ''}.`);
  }
  return String(response.token);
}

function parseCdrTime(value) {
  const text = String(value || '').trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  // Existing application stores IST-derived UTC clock values. Convert IST to UTC clock.
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) - (5.5 * 3600 * 1000);
  const d = new Date(ms);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function parseDuration(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  const rows = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (!lines.length) return rows;
  function split(line) {
    const out = []; let cur = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  const headers = split(lines[0]).map((h) => h.trim().toLowerCase());
  for (const line of lines.slice(1)) {
    const values = split(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function normalizeRow(row) {
  const direction = String(row.type || row.direction || '').trim();
  const normalizedType = direction.toLowerCase();

  let callType = null;
  if (normalizedType === 'internal') callType = 'internal';
  else if (normalizedType === 'inbound') callType = 'inbound';
  else if (normalizedType === 'outbound') callType = 'outbound';

  return {
    callId: String(row.callid || row.call_id || '').trim(),
    startAt: parseCdrTime(row.timestart || row.starttime),
    direction,
    callType,
    callFrom: String(row.callfrom || row.caller || '').trim() || null,
    callTo: String(row.callto || row.callee || '').trim() || null,
    trunk: String(row.srctrunkname || row.trunk || row.trunkname || row.dsttrunkname || '').trim() || null,
    didNumber: String(row.didnumber || row.did || '').trim() || null,
    durationSeconds: parseDuration(row.callduraction || row.callduration),
    talkDurationSeconds: parseDuration(row.talkduraction || row.talkduration),
    status: String(row.status || '').trim() || null,
    recording: String(row.recording || '').trim() || null,
    rawData: row,
  };
}

async function fetchCdr(cfg, starttime, endtime) {
  const token = await login(cfg);
  const randomResponse = await requestJson(cfg, `/cdr/get_random?token=${encodeURIComponent(token)}`, {
    number: 'all', starttime, endtime,
  });
  if (String(randomResponse.status || '').toLowerCase() !== 'success' || !randomResponse.random) {
    throw new Error(`S50 CDR request failed${randomResponse.errno ? ` (error ${randomResponse.errno})` : ''}.`);
  }
  const url = `${baseUrl(cfg)}/cdr/download?number=all&starttime=${encodeURIComponent(starttime)}&endtime=${encodeURIComponent(endtime)}&token=${encodeURIComponent(token)}&random=${encodeURIComponent(randomResponse.random)}`;
  const result = await requestBinary(cfg, url);
  return parseCsv(result.buffer.toString('utf8'));
}

async function syncRange(starttime, endtime) {
  const cfg = await loadConfig();
  if (!cfg) throw new Error('S50 CDR settings are not configured.');
  const rows = await fetchCdr(cfg, starttime, endtime);
  let inserted = 0; let updated = 0; let ignored = 0;
  for (const raw of rows) {
    const row = normalizeRow(raw);
    if (!row.callId || !row.startAt) { ignored += 1; continue; }
    if (!row.callType) {
      throw new Error(
        `Unsupported S50 CDR type "${row.direction || 'unknown'}" for call ${row.callId || 'unknown'}.`
      );
    }
    const result = await query(`
      INSERT INTO s50_call_logs
        (call_id,start_at,direction,call_type,call_from,call_to,trunk,did_number,duration_seconds,talk_duration_seconds,status,recording,raw_data,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
      ON CONFLICT (call_id) DO UPDATE SET
        start_at=EXCLUDED.start_at,
        direction=EXCLUDED.direction,
        call_type=EXCLUDED.call_type,
        call_from=EXCLUDED.call_from,
        call_to=EXCLUDED.call_to,
        trunk=EXCLUDED.trunk,
        did_number=EXCLUDED.did_number,
        duration_seconds=EXCLUDED.duration_seconds,
        talk_duration_seconds=EXCLUDED.talk_duration_seconds,
        status=EXCLUDED.status,
        recording=EXCLUDED.recording,
        raw_data=EXCLUDED.raw_data,
        updated_at=now()
      RETURNING (xmax = 0) AS inserted
    `, [row.callId,row.startAt,row.direction,row.callType,row.callFrom,row.callTo,row.trunk,row.didNumber,row.durationSeconds,row.talkDurationSeconds,row.status,row.recording,row.rawData]);
    if (result.rows[0]?.inserted) inserted += 1; else updated += 1;
  }
  await query('UPDATE s50_cdr_settings SET last_sync_at=now(), last_sync_status=$1, last_sync_message=$2, updated_at=now() WHERE id=1', ['success', `Fetched ${rows.length}; inserted ${inserted}; updated ${updated}; ignored ${ignored}.`]);
  return { fetched: rows.length, inserted, updated, ignored };
}

async function testConnection(input) {
  const cfg = { ...input, api_password: input.api_password || '' };
  const token = await login(cfg);
  const device = await requestJson(cfg, `/deviceinfo/query?token=${encodeURIComponent(token)}`, {});
  if (String(device.status || '').toLowerCase() !== 'success') throw new Error('S50 connection succeeded at login but PBX information could not be queried.');
  return device.deviceinfo || device.device_info || {};
}

async function getRecording(callId) {
  const result = await query('SELECT recording FROM s50_call_logs WHERE id = $1', [callId]);
  const recording = result.rows[0]?.recording;
  if (!recording) throw Object.assign(new Error('Recording not available for this call.'), { statusCode: 404 });
  const cfg = await loadConfig();
  const token = await login(cfg);
  const randomResponse = await requestJson(cfg, `/recording/get_random?token=${encodeURIComponent(token)}`, { recording });
  if (String(randomResponse.status || '').toLowerCase() !== 'success' || !randomResponse.random) throw new Error('S50 recording service did not provide a download token.');
  const url = `${baseUrl(cfg)}/recording/download?recording=${encodeURIComponent(recording)}&random=${encodeURIComponent(randomResponse.random)}&token=${encodeURIComponent(token)}`;
  return requestBinary(cfg, url);
}

async function saveSettings(body) {
  const current = await loadConfig();
  const passwordEnc = body.apiPassword ? encrypt(body.apiPassword) : current?.api_password_enc || null;
  const params = [
    !!body.enabled, body.server || null, ['http','https'].includes(body.apiProtocol) ? body.apiProtocol : 'https',
    Number(body.apiPort || 8088), String(body.apiVersion || '2.0.0'), body.apiUsername || null,
    passwordEnc, !!body.verifyTls, !!body.autoSync, Number(body.autoSyncMinutes || 15)
  ];
  const result = await query(`UPDATE s50_cdr_settings SET enabled=$1,server=$2,api_protocol=$3,api_port=$4,api_version=$5,api_username=$6,api_password_enc=$7,verify_tls=$8,auto_sync=$9,auto_sync_minutes=$10,updated_at=now() WHERE id=1 RETURNING id,enabled,server,api_protocol,api_port,api_version,api_username,verify_tls,auto_sync,auto_sync_minutes,last_sync_at,last_sync_status,last_sync_message,updated_at`, params);
  return result.rows[0];
}

function publicSettings(row) { return row ? { ...row, api_password_enc: undefined } : null; }

async function autoSyncOnce() {
  const cfg = await loadConfig();
  if (!cfg?.enabled || !cfg.auto_sync) return { skipped: true };
  if (cfg.last_sync_at) {
    const elapsed = Date.now() - new Date(cfg.last_sync_at).getTime();
    if (elapsed < Math.max(5, Number(cfg.auto_sync_minutes || 15)) * 60000) return { skipped: true };
  }
  const range = (() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
    const start = new Date(ist.getTime() - Math.max(1, Number(cfg.auto_sync_minutes || 15)) * 60000 * 2);
    const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
    return { start: fmt(start), end: fmt(ist) };
  })();
  return syncRange(range.start, range.end);
}

async function listExtensions() {
  const cfg = await loadConfig();
  if (!cfg) throw new Error('S50 CDR settings are not configured.');

  const token = await login(cfg);
  const response = await requestJson(
    cfg,
    `/extension/list?token=${encodeURIComponent(token)}`,
    {}
  );

  if (String(response.status || '').toLowerCase() !== 'success') {
    throw new Error(
      `S50 extension list request failed${response.errno ? ` (error ${response.errno})` : ''}.`
    );
  }

  return Array.isArray(response.extlist) ? response.extlist : [];
}

async function syncExtensions() {
  const extensions = await listExtensions();

  for (const ext of extensions) {
    const number = String(ext.number || ext.extension || '').trim();
    if (!number) continue;

    const username = String(ext.username || ext.name || '').trim() || null;
    const status = String(ext.status || '').trim() || null;
    const type = String(ext.type || '').trim() || null;

    await query(`
      INSERT INTO s50_extensions
        (extension_number, username, status, type, updated_at)
      VALUES ($1,$2,$3,$4,now())
      ON CONFLICT (extension_number) DO UPDATE SET
        username=EXCLUDED.username,
        status=EXCLUDED.status,
        type=EXCLUDED.type,
        updated_at=now()
    `, [number, username, status, type]);
  }

  return {
    fetched: extensions.length,
    extensions: extensions.filter((ext) => String(ext.number || ext.extension || '').trim()),
  };
}

async function getExtensionDirectory() {
  const result = await query(`
    SELECT extension_number, username, status, type, first_seen_at, updated_at
    FROM s50_extensions
    ORDER BY extension_number::text
  `);

  return result.rows;
}

async function getExtensionNames(numbers) {
  const values = [...new Set(
    (Array.isArray(numbers) ? numbers : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];

  if (!values.length) return {};

  const result = await query(`
    SELECT extension_number, username
    FROM s50_extensions
    WHERE extension_number = ANY($1::varchar[])
  `, [values]);

  return Object.fromEntries(
    result.rows.map((row) => [row.extension_number, row.username])
  );
}

module.exports = {
  loadConfig,
  fetchCdr,
  syncRange,
  testConnection,
  getRecording,
  saveSettings,
  publicSettings,
  autoSyncOnce,
  listExtensions,
  syncExtensions,
  getExtensionDirectory,
  getExtensionNames
};
