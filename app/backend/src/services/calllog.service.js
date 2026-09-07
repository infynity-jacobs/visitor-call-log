const { query } = require('../db/pool');

const COLUMNS = 'id, call_date, call_time, name, place, phone, reason, created_at';

function buildDateFilter({ mode, date, startDate, endDate }, paramOffset = 1) {
  const params = [];
  let clause = '';
  if (mode === 'single' && date) {
    clause = `WHERE call_date = $${paramOffset}`;
    params.push(date);
  } else if (mode === 'range' && startDate && endDate) {
    clause = `WHERE call_date BETWEEN $${paramOffset} AND $${paramOffset + 1}`;
    params.push(startDate, endDate);
  }
  return { clause, params };
}

async function create(data) {
  const sql = `
    INSERT INTO call_logs (call_date, call_time, name, place, phone, reason, created_by, idempotency_key)
    VALUES (COALESCE($1, CURRENT_DATE), COALESCE($2, CURRENT_TIME), $3, $4, $5, $6, $7, $8)
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

module.exports = { create, list, buildDateFilter };
