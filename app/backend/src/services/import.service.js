const ExcelJS = require('exceljs');
const crypto = require('crypto');
const { query, withTransaction } = require('../db/pool');
const { utcBoundsForIstDate } = require('../utils/timezone');

function clean(v) { return v == null ? '' : String(v).trim(); }
function phone(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(Math.trunc(v));
  return clean(v);
}
function excelDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getUTCFullYear()}-${String(v.getUTCMonth()+1).padStart(2,'0')}-${String(v.getUTCDate()).padStart(2,'0')}`;
  const s=clean(v); if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) { const [y,m,d]=s.split('-').map(Number); return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  return '';
}
function excelTime(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${String(v.getUTCHours()).padStart(2,'0')}:${String(v.getUTCMinutes()).padStart(2,'0')}:${String(v.getUTCSeconds()).padStart(2,'0')}`;
  if (v && typeof v === 'object' && typeof v.hours === 'number') return `${String(v.hours).padStart(2,'0')}:${String(v.minutes||0).padStart(2,'0')}:${String(v.seconds||0).padStart(2,'0')}`;
  const s=clean(v); const m=s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/); return m ? `${String(+m[1]).padStart(2,'0')}:${m[2]}:${m[3]||'00'}` : '';
}
function visitorRow(row, rowNo) {
  const purpose=clean(row[6]);
  const upper=purpose.toUpperCase();
  return { sourceSno: clean(row[0]) || String(rowNo), visitDate:excelDate(row[1]), visitTime:excelTime(row[2]), name:clean(row[3]), place:clean(row[4]), phone:phone(row[5]), purpose,
    purposeDetails:upper.includes('BILL PAY') ? (clean(row[10]) || clean(row[7])) : '', enquiryType:clean(row[8]), enquiryDetails:clean(row[9]), complaintDetails:clean(row[13]), purchaseDetails:clean(row[12]), personToVisit:clean(row[11]), interviewDetails:upper.includes('INTERVIEW') ? clean(row[7]) : '', donationDetails:upper.includes('DONATION') ? clean(row[7]) : '', otherDetails:upper.includes('OTHER') ? clean(row[7]) : '', importRaw: row.slice(0,14).map(v => v instanceof Date ? v.toISOString() : v) };
}
function callRow(row,rowNo) { return { sourceSno:clean(row[0])||String(rowNo), callDate:excelDate(row[1]), callTime:excelTime(row[2]), name:clean(row[3]), place:clean(row[4]), phone:phone(row[5]), reason:clean(row[6]), importRaw: row.slice(0,7).map(v => v instanceof Date ? v.toISOString() : v) }; }
function validate(type,r) { const errors=[]; if(!r.name) errors.push('Name is required'); if(!r[type==='visitors'?'visitDate':'callDate']) errors.push('Date is required'); if(!r[type==='visitors'?'visitTime':'callTime']) errors.push('Time is required'); if(type==='visitors'&&!r.purpose) errors.push('Purpose is required'); if(type==='calllog'){ if(!r.place) errors.push('Place is required'); if(!r.phone) errors.push('Phone is required'); if(!r.reason) errors.push('Reason is required'); } return errors; }
function istToUtcClock(date,time){
  const [y,m,d]=date.split('-').map(Number); const [hh,mm,ss]=time.split(':').map(Number);
  const utc=new Date(Date.UTC(y,m-1,d,hh,mm,ss||0)-330*60000);
  return {date:`${utc.getUTCFullYear()}-${String(utc.getUTCMonth()+1).padStart(2,'0')}-${String(utc.getUTCDate()).padStart(2,'0')}`,time:`${String(utc.getUTCHours()).padStart(2,'0')}:${String(utc.getUTCMinutes()).padStart(2,'0')}:${String(utc.getUTCSeconds()).padStart(2,'0')}`};
}

async function parse({buffer,type,filename,sourceTimezone='Asia/Kolkata'}) {
  const wb=new ExcelJS.Workbook(); await wb.xlsx.load(buffer); const sheet=wb.worksheets[0]; if(!sheet) throw new Error('Workbook contains no worksheets.');
  const rows=[]; sheet.eachRow((row,n)=>{ if(n===1) return; const vals=row.values.slice(1); if(!vals.slice(0,7).some(v=>clean(v))) return; rows.push(type==='visitors'?visitorRow(vals,n):callRow(vals,n)); });
  const preview=rows.slice(0,25).map((r,i)=>({row:i+2,data:r,errors:validate(type,r)}));
  return {sheet:sheet.name,totalRows:rows.length,preview,rows};
}
async function preview(args){ return parse(args); }
async function importWorkbook({buffer,type,filename,sourceTimezone='Asia/Kolkata',userId}) {
  const sha256=crypto.createHash('sha256').update(buffer).digest('hex');
  const parsed=await parse({buffer,type,filename,sourceTimezone});
  return withTransaction(async client=>{
    const existing=await client.query('SELECT id, imported_rows, skipped_rows, failed_rows FROM import_batches WHERE record_type=$1 AND source_sha256=$2',[type,sha256]);
    if(existing.rows.length) return {alreadyImported:true,batch:existing.rows[0],...parsed,imported:0,skipped:parsed.totalRows,failed:0};
    const batch=(await client.query('INSERT INTO import_batches(record_type,source_filename,source_sha256,source_timezone,total_rows,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[type,filename,sha256,sourceTimezone,parsed.totalRows,userId])).rows[0];
    let imported=0,failed=0;
    for(let i=0;i<parsed.rows.length;i++) { let r=parsed.rows[i]; const errors=validate(type,r); if(errors.length){failed++; continue;}
      if(type==='visitors') { const utc=istToUtcClock(r.visitDate,r.visitTime); r={...r,visitDate:utc.date,visitTime:utc.time}; } else { const utc=istToUtcClock(r.callDate,r.callTime); r={...r,callDate:utc.date,callTime:utc.time}; }
      if(type==='visitors') await client.query(`INSERT INTO visitors(visit_date,visit_time,name,place,phone,purpose,purpose_details,enquiry_type,enquiry_details,complaint_details,purchase_details,person_to_visit,person_to_visit_other,interview_details,donation_details,other_details,created_by,import_batch_id,source_sno,import_raw) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,[r.visitDate,r.visitTime,r.name,r.place||null,r.phone||null,r.purpose,r.purposeDetails||null,r.enquiryType||null,r.enquiryDetails||null,r.complaintDetails||null,r.purchaseDetails||null,r.personToVisit||null,r.personToVisitOther||null,r.interviewDetails||null,r.donationDetails||null,r.otherDetails||null,userId,batch.id,r.sourceSno,JSON.stringify(r.importRaw)]);
      else await client.query(`INSERT INTO call_logs(call_date,call_time,name,place,phone,reason,created_by,import_batch_id,source_sno,import_raw) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[r.callDate,r.callTime,r.name,r.place,r.phone,r.reason,userId,batch.id,r.sourceSno,JSON.stringify(r.importRaw)]); imported++; }
    await client.query('UPDATE import_batches SET imported_rows=$1, skipped_rows=$2, failed_rows=$3 WHERE id=$4',[imported,0,failed,batch.id]);
    await client.query('INSERT INTO audit_log(user_id,action,details) VALUES($1,$2,$3)',[userId,'data_import',{batchId:batch.id,recordType:type,filename,totalRows:parsed.totalRows,imported,failed}]);
    return {alreadyImported:false,batch:{id:batch.id},totalRows:parsed.totalRows,imported,skipped:0,failed,preview:parsed.preview};
  });
}
module.exports={preview,importWorkbook};
