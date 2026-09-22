const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../db/pool');
const s50 = require('../services/s50.service');
const { ValidationError } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

function istToStoredUtcClock(text) {
  const d = new Date(text.replace(' ', 'T') + '+05:30');
  if (Number.isNaN(d.getTime())) throw new ValidationError('Invalid date/time.');
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function validateDateTime(value, label) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text)) throw new ValidationError(`${label} is invalid.`);
  return text.replace('T', ' ') + (text.length === 16 ? ':00' : '');
}

function formatDefaultRange(days = 1) {
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 3600 * 1000;
  const end = new Date(istMs);
  const start = new Date(istMs - days * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
  return { start: fmt(start), end: fmt(end) };
}

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '100', 10) || 100, 1), 500);
    const offset = Math.max(Number.parseInt(req.query.offset || '0', 10) || 0, 0);
    const params = [];
    const where = [];
    if (req.query.startDateTime) { params.push(validateDateTime(req.query.startDateTime, 'Start')); where.push(`start_at >= $${params.length}::timestamp`); params[params.length-1] = istToStoredUtcClock(params[params.length-1]); }
    if (req.query.endDateTime) { params.push(validateDateTime(req.query.endDateTime, 'End')); where.push(`start_at <= $${params.length}::timestamp`); params[params.length-1] = istToStoredUtcClock(params[params.length-1]); }
    if (req.query.direction && req.query.direction !== 'all') { params.push(req.query.direction); where.push(`lower(direction) = lower($${params.length})`); }
    if (req.query.status && req.query.status !== 'all') { params.push(req.query.status); where.push(`lower(status) = lower($${params.length})`); }
    if (req.query.extension) { params.push(`%${req.query.extension}%`); where.push(`(call_from ILIKE $${params.length} OR call_to ILIKE $${params.length})`); }
    if (req.query.search) { params.push(`%${req.query.search}%`); where.push(`(call_from ILIKE $${params.length} OR call_to ILIKE $${params.length} OR COALESCE(trunk,'') ILIKE $${params.length} OR COALESCE(did_number,'') ILIKE $${params.length})`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await query(`SELECT count(*)::int AS total FROM s50_call_logs ${clause}`, params);
    params.push(limit, offset);
    const records = await query(`SELECT id,call_id,start_at,direction,call_from,call_to,trunk,did_number,duration_seconds,talk_duration_seconds,status,recording FROM s50_call_logs ${clause} ORDER BY start_at DESC,id DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    res.json({ records: records.rows, total: count.rows[0].total, limit, offset });
  } catch (err) { next(err); }
});

router.get('/status', async (req, res, next) => {
  try {
    const result = await query('SELECT enabled,server,api_protocol,api_port,api_version,auto_sync,auto_sync_minutes,last_sync_at,last_sync_status,last_sync_message FROM s50_cdr_settings WHERE id=1');
    res.json({ s50: result.rows[0] });
  } catch (err) { next(err); }
});

router.post('/sync', async (req, res, next) => {
  try {
    const defaults = formatDefaultRange(1);
    const starttime = req.body?.starttime ? validateDateTime(req.body.starttime, 'Start') : defaults.start;
    const endtime = req.body?.endtime ? validateDateTime(req.body.endtime, 'End') : defaults.end;
    const result = await s50.syncRange(starttime, endtime);
    res.json({ success: true, starttime, endtime, result });
  } catch (err) {
    try { await query('UPDATE s50_cdr_settings SET last_sync_at=now(),last_sync_status=$1,last_sync_message=$2,updated_at=now() WHERE id=1', ['error', err.message]); } catch (_) {}
    next(err);
  }
});

router.get('/:id/recording', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid CDR record ID.');
    const result = await s50.getRecording(id);
    res.setHeader('Content-Type', result.contentType || 'audio/wav');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(result.buffer);
  } catch (err) { next(err); }
});

module.exports = router;
