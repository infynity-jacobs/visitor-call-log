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

    // Server-side S50 visibility policy:
    // Super Admin / Admin / Manager: all call types.
    // Normal users: inbound and outbound only.
    if (req.user?.role === 'user') {
      where.push(`c.call_type IN ('inbound', 'outbound', 'transfer')`);
    }

    if (req.query.startDateTime) {
      params.push(validateDateTime(req.query.startDateTime, 'Start'));
      where.push(`c.start_at >= $${params.length}::timestamp`);
      params[params.length - 1] = istToStoredUtcClock(params[params.length - 1]);
    }

    if (req.query.endDateTime) {
      params.push(validateDateTime(req.query.endDateTime, 'End'));
      where.push(`c.start_at <= $${params.length}::timestamp`);
      params[params.length - 1] = istToStoredUtcClock(params[params.length - 1]);
    }

    if (req.query.direction && req.query.direction !== 'all') {
      params.push(req.query.direction);
      where.push(`lower(c.direction) = lower($${params.length})`);
    }

    if (req.query.status && req.query.status !== 'all') {
      params.push(req.query.status);
      where.push(`lower(c.status) = lower($${params.length})`);
    }

    if (req.query.extension) {
      params.push(`%${req.query.extension}%`);
      where.push(`(
        c.call_from ILIKE $${params.length}
        OR c.call_to ILIKE $${params.length}
        OR EXISTS (
          SELECT 1
          FROM s50_extensions e
          WHERE e.extension_number ILIKE $${params.length}
            AND (
              e.extension_number = c.call_from
              OR e.extension_number = c.call_to
            )
        )
        OR EXISTS (
          SELECT 1
          FROM s50_extensions e
          WHERE e.username ILIKE $${params.length}
            AND (
              e.extension_number = c.call_from
              OR e.extension_number = c.call_to
            )
        )
      )`);
    }

    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where.push(`(
        c.call_from ILIKE $${params.length}
        OR c.call_to ILIKE $${params.length}
        OR COALESCE(c.trunk,'') ILIKE $${params.length}
        OR COALESCE(c.did_number,'') ILIKE $${params.length}
        OR EXISTS (
          SELECT 1
          FROM s50_extensions e
          WHERE e.extension_number = c.call_from
            AND e.username ILIKE $${params.length}
        )
        OR EXISTS (
          SELECT 1
          FROM s50_extensions e
          WHERE e.extension_number = c.call_to
            AND e.username ILIKE $${params.length}
        )
      )`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const count = await query(
      `SELECT count(*)::int AS total
       FROM s50_call_logs c
       ${clause}`,
      params
    );

    params.push(limit, offset);

    const records = await query(`
      SELECT
        c.id,
        c.call_id,
        c.start_at,
        c.direction,
        c.call_type,
        c.call_from,
        c.call_to,
        ef.username AS from_name,
        et.username AS to_name,
        c.trunk,
        c.did_number,
        c.duration_seconds,
        c.talk_duration_seconds,
        c.status,
        c.recording
      FROM s50_call_logs c
      LEFT JOIN s50_extensions ef
        ON ef.extension_number = c.call_from
      LEFT JOIN s50_extensions et
        ON et.extension_number = c.call_to
      ${clause}
      ORDER BY c.start_at DESC, c.id DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `, params);

    res.json({
      records: records.rows,
      total: count.rows[0].total,
      limit,
      offset
    });
  } catch (err) {
    next(err);
  }
});

router.post('/extensions/sync', async (req, res, next) => {
  try {
    if (!['admin', 'manager', 'super_admin'].includes(req.user?.role)) {
      const err = new Error('Administrator or Manager access required.');
      err.statusCode = 403;
      throw err;
    }

    const result = await s50.syncExtensions();
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.get('/extensions', async (req, res, next) => {
  try {
    if (!['admin', 'manager', 'super_admin'].includes(req.user?.role)) {
      const err = new Error('Administrator or Manager access required.');
      err.statusCode = 403;
      throw err;
    }

    const records = await s50.getExtensionDirectory();
    res.json({ records });
  } catch (err) {
    next(err);
  }
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
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new ValidationError('Invalid CDR record ID.');
    }

    // Normal users cannot retrieve recordings belonging to
    // extension-to-extension (internal) calls.
    if (req.user?.role === 'user') {
      const access = await query(
        'SELECT call_type FROM s50_call_logs WHERE id = $1',
        [id]
      );

      if (!access.rows.length) {
        const err = new Error('CDR record not found.');
        err.statusCode = 404;
        throw err;
      }

      if (access.rows[0].call_type === 'internal') {
        const err = new Error(
          'Recording access is not permitted for internal calls.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    const result = await s50.getRecording(id);
    res.setHeader('Content-Type', result.contentType || 'audio/wav');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(result.buffer);
  } catch (err) { next(err); }
});

module.exports = router;
