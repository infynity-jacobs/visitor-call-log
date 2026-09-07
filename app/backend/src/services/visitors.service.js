const { query } = require('../db/pool');

const COLUMNS = `
  id, visit_date, visit_time, name, place, phone, purpose, purpose_details,
  enquiry_type, enquiry_details, complaint_details, purchase_details,
  person_to_visit, person_to_visit_other, interview_details,
  donation_details, other_details, created_at
`;

function buildDateFilter({ mode, date, startDate, endDate }, paramOffset = 1) {
  const params = [];
  let clause = '';
  // Database date/time values are stored as UTC clock values. Convert the
  // requested IST calendar day/range into UTC bounds before querying.
  if (mode === 'single' && date) {
    clause = `WHERE (visit_date + visit_time) >= ($${paramOffset}::timestamp)
              AND (visit_date + visit_time) < ($${paramOffset + 1}::timestamp)`;
    const { utcBoundsForIstDate, nextIstDate } = require('../utils/timezone');
    const start = utcBoundsForIstDate(date);
    const end = utcBoundsForIstDate(nextIstDate(date));
    params.push(`${start.date} ${start.time}`, `${end.date} ${end.time}`);
  } else if (mode === 'range' && startDate && endDate) {
    clause = `WHERE (visit_date + visit_time) >= ($${paramOffset}::timestamp)
              AND (visit_date + visit_time) < ($${paramOffset + 1}::timestamp)`;
    const { utcBoundsForIstDate, nextIstDate } = require('../utils/timezone');
    const start = utcBoundsForIstDate(startDate);
    const end = utcBoundsForIstDate(nextIstDate(endDate));
    params.push(`${start.date} ${start.time}`, `${end.date} ${end.time}`);
  }
  return { clause, params };
}

async function create(data) {
  const sql = `
    INSERT INTO visitors (
      visit_date, visit_time, name, place, phone, purpose, purpose_details,
      enquiry_type, enquiry_details, complaint_details, purchase_details,
      person_to_visit, person_to_visit_other, interview_details,
      donation_details, other_details, created_by, idempotency_key
    ) VALUES (
      COALESCE($1::date, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date),
      COALESCE($2::time, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::time), $3, $4, $5, $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14,
      $15, $16, $17, $18
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING ${COLUMNS}
  `;
  const params = [
    data.visitDate || null, data.visitTime || null, data.name, data.place || null, data.phone || null,
    data.purpose, data.purposeDetails || null,
    data.enquiryType || null, data.enquiryDetails || null, data.complaintDetails || null, data.purchaseDetails || null,
    data.personToVisit || null, data.personToVisitOther || null, data.interviewDetails || null,
    data.donationDetails || null, data.otherDetails || null, data.createdBy || null, data.idempotencyKey || null
  ];
  const result = await query(sql, params);
  if (result.rows.length === 0 && data.idempotencyKey) {
    const existing = await query(`SELECT ${COLUMNS} FROM visitors WHERE idempotency_key = $1`, [data.idempotencyKey]);
    return { record: existing.rows[0], duplicate: true };
  }
  return { record: result.rows[0], duplicate: false };
}

async function list({ mode = 'all', date, startDate, endDate, limit = 500, offset = 0 } = {}) {
  const { clause, params } = buildDateFilter({ mode, date, startDate, endDate }, 1);
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;
  const sql = `
    SELECT ${COLUMNS} FROM visitors
    ${clause}
    ORDER BY visit_date DESC, visit_time DESC, id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const result = await query(sql, [...params, limit, offset]);
  return result.rows;
}

async function getById(id) {
  const result = await query(`SELECT ${COLUMNS} FROM visitors WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

module.exports = { create, list, getById, buildDateFilter };
