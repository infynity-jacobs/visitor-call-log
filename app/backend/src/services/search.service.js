const { query } = require('../db/pool');

const VISITOR_SEARCH = `
  SELECT id, 'visitor' AS type, visit_date AS record_date, visit_time AS record_time,
         name, place, phone, purpose AS category, enquiry_type, NULL::text AS reason,
         person_to_visit, purpose_details, enquiry_details, complaint_details,
         purchase_details, interview_details, donation_details, other_details
  FROM visitors
  WHERE name ILIKE $1 OR COALESCE(place,'') ILIKE $1 OR COALESCE(phone,'') ILIKE $1
     OR COALESCE(purpose,'') ILIKE $1 OR COALESCE(enquiry_type,'') ILIKE $1
     OR COALESCE(person_to_visit,'') ILIKE $1
     OR to_char((visit_date + visit_time) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') ILIKE $1
`;

const CALL_SEARCH = `
  SELECT id, 'calllog' AS type, call_date AS record_date, call_time AS record_time,
         name, place, phone, NULL::text AS category, NULL::text AS enquiry_type,
         reason, NULL::text AS person_to_visit, NULL::text AS purpose_details,
         NULL::text AS enquiry_details, NULL::text AS complaint_details,
         NULL::text AS purchase_details, NULL::text AS interview_details,
         NULL::text AS donation_details, NULL::text AS other_details
  FROM call_logs
  WHERE name ILIKE $1 OR COALESCE(place,'') ILIKE $1 OR COALESCE(phone,'') ILIKE $1
     OR reason ILIKE $1
     OR to_char((call_date + call_time) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') ILIKE $1
`;

async function search(term, limit = 100) {
  const pattern = `%${term}%`;
  const [visitors, calls] = await Promise.all([
    query(`${VISITOR_SEARCH} ORDER BY visit_date DESC, visit_time DESC, id DESC LIMIT $2`, [pattern, limit]),
    query(`${CALL_SEARCH} ORDER BY call_date DESC, call_time DESC, id DESC LIMIT $2`, [pattern, limit])
  ]);
  return [...visitors.rows, ...calls.rows]
    .sort((a,b) => `${b.record_date} ${b.record_time}`.localeCompare(`${a.record_date} ${a.record_time}`))
    .slice(0, limit);
}

module.exports = { search };
