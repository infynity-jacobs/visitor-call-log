const { query } = require('../db/pool');
const { utcBoundsForIstDate, nextIstDate } = require('../utils/timezone');

const COLUMNS = 'id, call_date, call_time, name, place, phone, reason, created_at';

function buildDateFilter({ mode, date, startDate, endDate }, paramOffset = 1) {
  const params = [];
  let clause = '';
  if (mode === 'single' && date) {
    clause = `WHERE (call_date + call_time) >= ($${paramOffset}::timestamp)
              AND (call_date + call_time) < ($${paramOffset + 1}::timestamp)`;
    const start = utcBoundsForIstDate(date);
    const end = utcBoundsForIstDate(nextIstDate(date));
    params.push(`${start.date} ${start.time}`, `${end.date} ${end.time}`);
  } else if (mode === 'range' && startDate && endDate) {
    clause = `WHERE (call_date + call_time) >= ($${paramOffset}::timestamp)
              AND (call_date + call_time) < ($${paramOffset + 1}::timestamp)`;
    const start = utcBoundsForIstDate(startDate);
    const end = utcBoundsForIstDate(nextIstDate(endDate));
    params.push(`${start.date} ${start.time}`, `${end.date} ${end.time}`);
  }
  return { clause, params };
}

async function create(data) {
  const sql = `
    INSERT INTO call_logs (call_date, call_time, name, place, phone, reason, created_by, idempotency_key)
    VALUES (COALESCE($1::date, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
            COALESCE($2::time, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::time), $3, $4, $5, $6, $7, $8)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING ${COLUMNS}
  `;
  const params = [
    data.callDate || null, data.callTime || null, data.name, data.place || null,
    data.phone || null, data.reason, data.createdBy || null, data.idempotencyKey || null
  ];
  const result = await query(sql, params);
  if (result.rows.length === 0 && data.idempotencyKey) {
    const existing = await query(`SELECT ${COLUMNS} FROM call_logs WHERE idempotency_key = $1`, [data.idempotencyKey]);
    return { record: existing.rows[0], duplicate: true };
  }
  return { record: result.rows[0], duplicate: false };
}

async function list({ mode = 'all', date, startDate, endDate, limit = 500, offset = 0 } = {}) {
  const { clause, params } = buildDateFilter({ mode, date, startDate, endDate }, 1);
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const sql = `
    SELECT ${COLUMNS} FROM call_logs
    ${clause}
    ORDER BY call_date DESC, call_time DESC, id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const result = await query(sql, [...params, limit, offset]);
  return result.rows;
}

async function getById(id) {
  const result = await query(`SELECT ${COLUMNS} FROM call_logs WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

module.exports = { create, list, getById, buildDateFilter };
