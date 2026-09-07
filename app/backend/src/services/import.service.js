const ExcelJS = require('exceljs');
const crypto = require('crypto');
const { withTransaction } = require('../db/pool');

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const SOURCE_TIMEZONE = 'Asia/Kolkata';

function clean(v) {
  return v == null ? '' : String(v).trim();
}

function phone(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  return clean(v);
}

function excelSerialDate(serial) {
  // Excel's 1900 date system. Return the calendar date represented by the cell,
  // without applying the server timezone.
  const epoch = Date.UTC(1899, 11, 30);
  const ms = Math.round(Number(serial) * 86400000);
  const d = new Date(epoch + ms);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function excelDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') return excelSerialDate(v);
  const s = clean(v);
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const candidate = new Date(Date.UTC(y, m - 1, d));
    if (candidate.getUTCFullYear() === y && candidate.getUTCMonth() === m - 1 && candidate.getUTCDate() === d) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  const match = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match.map(Number);
    const candidate = new Date(Date.UTC(y, m - 1, d));
    if (candidate.getUTCFullYear() === y && candidate.getUTCMonth() === m - 1 && candidate.getUTCDate() === d) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return '';
}

function excelTime(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}:${String(v.getUTCSeconds()).padStart(2, '0')}`;
  }
  if (v && typeof v === 'object' && typeof v.hours === 'number') {
    return `${String(v.hours).padStart(2, '0')}:${String(v.minutes || 0).padStart(2, '0')}:${String(v.seconds || 0).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const total = Math.round(v * 86400) % 86400;
    return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  const s = clean(v);
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return '';
  const hh = Number(m[1]); const mm = Number(m[2]); const ss = Number(m[3] || 0);
  if (hh > 23 || mm > 59 || ss > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function normalizeHeader(v) {
  return clean(v).toUpperCase().replace(/&/g, 'AND').replace(/[^A-Z0-9]+/g, ' ').trim();
}

function buildHeaderMap(values) {
  const map = new Map();
  values.forEach((v, i) => {
    const key = normalizeHeader(v);
    if (key && !map.has(key)) map.set(key, i);
  });
  return map;
}

function get(row, map, ...names) {
  for (const name of names) {
    const idx = map.get(normalizeHeader(name));
    if (idx !== undefined) return row[idx];
  }
  return '';
}

function serializeRaw(values) {
  return values.map((v) => (v instanceof Date ? v.toISOString() : v));
}

function visitorRow(row, map, rowNo) {
  const purpose = clean(get(row, map, 'PURPOSE'));
  const upper = purpose.toUpperCase();
  const purposeDetailsOther = clean(get(row, map, 'PURPOSE DETAILS OTHER'));
  return {
    sourceSno: clean(get(row, map, 'SNO')) || String(rowNo),
    visitDate: excelDate(get(row, map, 'DATE')),
    visitTime: excelTime(get(row, map, 'TIME')),
    name: clean(get(row, map, 'NAME')),
    place: clean(get(row, map, 'PLACE')),
    phone: phone(get(row, map, 'PHONE')),
    purpose,
    purposeDetails: upper.includes('BILL PAY')
      ? (clean(get(row, map, 'BILLPAY DETAILS')) || purposeDetailsOther)
      : '',
    enquiryType: clean(get(row, map, 'ENQUIRY TYPE')),
    enquiryDetails: clean(get(row, map, 'ENQUIRY DETAILS')),
    complaintDetails: clean(get(row, map, 'COMPLAINT DETAILS')),
    purchaseDetails: clean(get(row, map, 'PURCHASE DETAILS')),
    personToVisit: clean(get(row, map, 'PERSON TO VISIT', 'PERSON TO VISIT NAME')),
    personToVisitOther: clean(get(row, map, 'PERSON TO VISIT OTHER')),
    interviewDetails: upper.includes('INTERVIEW') ? purposeDetailsOther : '',
    donationDetails: upper.includes('DONATION') ? purposeDetailsOther : '',
    otherDetails: upper.includes('OTHER') ? purposeDetailsOther : '',
    importRaw: serializeRaw(row),
  };
}

function callRow(row, map, rowNo) {
  return {
    sourceSno: clean(get(row, map, 'SNO')) || String(rowNo),
    callDate: excelDate(get(row, map, 'DATE')),
    callTime: excelTime(get(row, map, 'TIME')),
    name: clean(get(row, map, 'NAME')),
    place: clean(get(row, map, 'PLACE')),
    phone: phone(get(row, map, 'PHONE')),
    reason: clean(get(row, map, 'REASON')),
    importRaw: serializeRaw(row),
  };
}

function validateDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const candidate = new Date(Date.UTC(y, m - 1, d));
  return candidate.getUTCFullYear() === y && candidate.getUTCMonth() === m - 1 && candidate.getUTCDate() === d;
}

function validateTime(time) {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) return false;
  const [h, m, s] = time.split(':').map(Number);
  return h <= 23 && m <= 59 && s <= 59;
}

function validate(type, r) {
  const errors = [];
  const date = type === 'visitors' ? r.visitDate : r.callDate;
  const time = type === 'visitors' ? r.visitTime : r.callTime;
  if (!r.name) errors.push('Name is required');
  if (!date) errors.push('Date is required'); else if (!validateDate(date)) errors.push('Invalid date');
  if (!time) errors.push('Time is required'); else if (!validateTime(time)) errors.push('Invalid time');
  if (type === 'visitors') {
    if (!r.purpose) errors.push('Purpose is required');
  } else {
    if (!r.place) errors.push('Place is required');
    if (!r.phone) errors.push('Phone is required');
    if (!r.reason) errors.push('Reason is required');
  }
  return errors;
}

function istToUtcClock(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, hh, mm, ss) - 330 * 60000);
  return {
    date: `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`,
    time: `${String(utc.getUTCHours()).padStart(2, '0')}:${String(utc.getUTCMinutes()).padStart(2, '0')}:${String(utc.getUTCSeconds()).padStart(2, '0')}`,
  };
}

function expectedHeaders(type) {
  return type === 'visitors'
    ? ['SNO', 'DATE', 'TIME', 'NAME', 'PLACE', 'PHONE', 'PURPOSE']
    : ['SNO', 'DATE', 'TIME', 'NAME', 'PLACE', 'PHONE', 'REASON'];
}

async function parse({ buffer, type, filename }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Excel file is empty.');
  if (buffer.length > MAX_FILE_BYTES) throw new Error('Excel file is too large. Maximum size is 8 MB.');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('Workbook contains no worksheets.');

  const headerRow = sheet.getRow(1);
  const headerValues = headerRow.values.slice(1);
  const headerMap = buildHeaderMap(headerValues);
  const missingHeaders = expectedHeaders(type).filter((h) => !headerMap.has(normalizeHeader(h)));
  if (missingHeaders.length) {
    throw new Error(`Unsupported ${type === 'visitors' ? 'Visitor Register' : 'Call Log'} worksheet. Missing columns: ${missingHeaders.join(', ')}.`);
  }

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNo) => {
    if (rowNo === 1) return;
    const values = row.values.slice(1);
    if (!values.slice(0, 7).some((v) => clean(v))) return;
    rows.push(type === 'visitors' ? visitorRow(values, headerMap, rowNo) : callRow(values, headerMap, rowNo));
  });

  const checked = rows.map((r, i) => ({ row: i + 2, data: r, errors: validate(type, r) }));
  const errorCount = checked.filter((r) => r.errors.length).length;
  return {
    filename,
    sheet: sheet.name,
    totalRows: rows.length,
    validRows: rows.length - errorCount,
    invalidRows: errorCount,
    preview: checked.slice(0, 25),
    rows,
  };
}

async function preview(args) {
  return parse(args);
}

async function importWorkbook({ buffer, type, filename, userId }) {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const parsed = await parse({ buffer, type, filename });
  const invalidRows = parsed.invalidRows;
  if (invalidRows > 0) {
    throw new Error(`Import blocked: ${invalidRows} row(s) failed validation. Correct the workbook and preview it again.`);
  }

  return withTransaction(async (client) => {
    const existing = await client.query(
      'SELECT id, imported_rows, skipped_rows, failed_rows, created_at FROM import_batches WHERE record_type=$1 AND source_sha256=$2',
      [type, sha256]
    );
    if (existing.rows.length) {
      return {
        alreadyImported: true,
        batch: existing.rows[0],
        sheet: parsed.sheet,
        totalRows: parsed.totalRows,
        imported: 0,
        skipped: 0,
        failed: 0,
      };
    }

    const batch = (await client.query(
      `INSERT INTO import_batches(record_type,source_filename,source_sha256,source_timezone,total_rows,created_by)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [type, filename, sha256, SOURCE_TIMEZONE, parsed.totalRows, userId]
    )).rows[0];

    let imported = 0;
    for (const original of parsed.rows) {
      let r = original;
      if (type === 'visitors') {
        const utc = istToUtcClock(r.visitDate, r.visitTime);
        r = { ...r, visitDate: utc.date, visitTime: utc.time };
        await client.query(
          `INSERT INTO visitors(
             visit_date,visit_time,name,place,phone,purpose,purpose_details,enquiry_type,enquiry_details,
             complaint_details,purchase_details,person_to_visit,person_to_visit_other,interview_details,
             donation_details,other_details,created_by,import_batch_id,source_sno,import_raw
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
          [r.visitDate, r.visitTime, r.name, r.place || null, r.phone || null, r.purpose,
            r.purposeDetails || null, r.enquiryType || null, r.enquiryDetails || null,
            r.complaintDetails || null, r.purchaseDetails || null, r.personToVisit || null,
            r.personToVisitOther || null, r.interviewDetails || null, r.donationDetails || null,
            r.otherDetails || null, userId, batch.id, r.sourceSno, JSON.stringify(r.importRaw)]
        );
      } else {
        const utc = istToUtcClock(r.callDate, r.callTime);
        r = { ...r, callDate: utc.date, callTime: utc.time };
        await client.query(
          `INSERT INTO call_logs(call_date,call_time,name,place,phone,reason,created_by,import_batch_id,source_sno,import_raw)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [r.callDate, r.callTime, r.name, r.place, r.phone, r.reason, userId, batch.id, r.sourceSno, JSON.stringify(r.importRaw)]
        );
      }
      imported += 1;
    }

    await client.query(
      'UPDATE import_batches SET imported_rows=$1, skipped_rows=$2, failed_rows=$3 WHERE id=$4',
      [imported, 0, 0, batch.id]
    );
    await client.query(
      'INSERT INTO audit_log(user_id,action,details) VALUES($1,$2,$3)',
      [userId, 'data_import', { batchId: batch.id, recordType: type, filename, totalRows: parsed.totalRows, imported, failed: 0 }]
    );

    return {
      alreadyImported: false,
      batch: { id: batch.id },
      sheet: parsed.sheet,
      totalRows: parsed.totalRows,
      imported,
      skipped: 0,
      failed: 0,
    };
  });
}

async function listBatches({ limit = 20 } = {}) {
  const { query } = require('../db/pool');
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const result = await query(
    `SELECT b.id,b.record_type,b.source_filename,b.source_timezone,b.total_rows,b.imported_rows,
            b.skipped_rows,b.failed_rows,b.created_at,u.username AS created_by_username
       FROM import_batches b
       LEFT JOIN users u ON u.id=b.created_by
      ORDER BY b.id DESC LIMIT $1`,
    [safeLimit]
  );
  return { batches: result.rows };
}

module.exports = { preview, importWorkbook, listBatches, MAX_FILE_BYTES };
