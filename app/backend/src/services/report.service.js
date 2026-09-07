const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs/promises');
const { query } = require('../db/pool');
const { formatIstDateTime } = require('../utils/timezone');

async function getBranding() {
  const result = await query('SELECT * FROM branding_settings WHERE id = 1');
  return result.rows[0] || {};
}

async function loadLogoBuffer(logoPath) {
  if (!logoPath) return null;
  const value = String(logoPath).trim();
  try {
    if (value.startsWith('data:image/')) {
      const comma = value.indexOf(',');
      if (comma < 0) return null;
      const buffer = Buffer.from(value.slice(comma + 1), 'base64');
      return buffer.length <= 5 * 1024 * 1024 ? buffer : null;
    }
    if (/^https?:\/\//i.test(value)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(value, { signal: controller.signal });
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        return buffer.length <= 5 * 1024 * 1024 ? buffer : null;
      } finally {
        clearTimeout(timeout);
      }
    }
    const buffer = await fs.readFile(value);
    return buffer.length <= 5 * 1024 * 1024 ? buffer : null;
  } catch (err) {
    console.warn('[report] unable to load branding logo:', err.message);
    return null;
  }
}

function formatFilterLabel({ mode, date, startDate, endDate }) {
  if (mode === 'single' && date) return `Date: ${date}`;
  if (mode === 'range' && startDate && endDate) return `Date range: ${startDate} to ${endDate}`;
  return 'All records';
}

const VISITOR_COLUMNS = [
  { header: 'S.No.', key: 'report_sno', width: 8 },
  { header: 'Date', key: 'visit_date', width: 12 },
  { header: 'Time', key: 'visit_time', width: 10 },
  { header: 'Name', key: 'name', width: 22 },
  { header: 'Place', key: 'place', width: 18 },
  { header: 'Phone', key: 'phone', width: 15 },
  { header: 'Purpose', key: 'purpose', width: 14 },
  { header: 'Purpose Detail', key: 'purpose_detail_combined', width: 30 }
];

const CALLLOG_COLUMNS = [
  { header: 'S.No.', key: 'report_sno', width: 8 },
  { header: 'Date', key: 'call_date', width: 12 },
  { header: 'Time', key: 'call_time', width: 10 },
  { header: 'Name', key: 'name', width: 22 },
  { header: 'Place', key: 'place', width: 18 },
  { header: 'Phone', key: 'phone', width: 15 },
  { header: 'Reason', key: 'reason', width: 40 }
];

function combinedVisitorDetail(row) {
  return row.purpose_details || row.enquiry_details || row.complaint_details || row.purchase_details
    || (row.person_to_visit ? `${row.person_to_visit}${row.person_to_visit_other ? ` (${row.person_to_visit_other})` : ''}` : null)
    || row.interview_details || row.donation_details || row.other_details || '';
}

// ---------------------------------------------------------------------
// Excel generation
// ---------------------------------------------------------------------
async function generateExcel({ title, columns, rows, filterLabel }) {
  const branding = await getBranding();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = branding.org_name || 'Visitor Register & Call Log System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 5 }]
  });

  const endCol = columns.length;
  const endLetter = String.fromCharCode(64 + endCol);

  sheet.mergeCells(`A1:${endLetter}1`);
  sheet.getCell('A1').value = branding.org_name || 'Organization';
  sheet.getCell('A1').font = { size: 16, bold: true };

  sheet.mergeCells(`A2:${endLetter}2`);
  sheet.getCell('A2').value = [branding.address, branding.phone, branding.email, branding.website].filter(Boolean).join(' | ');
  sheet.getCell('A2').font = { size: 10, italic: true };

  sheet.mergeCells(`A3:${endLetter}3`);
  sheet.getCell('A3').value = branding.report_header || title;
  sheet.getCell('A3').font = { size: 13, bold: true };

  sheet.mergeCells(`A4:${endLetter}4`);
  sheet.getCell('A4').value = `${title} — ${filterLabel} | Generated (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}`;
  sheet.getCell('A4').font = { size: 9, italic: true };

  sheet.getRow(5).values = columns.map((c) => c.header);
  sheet.getRow(5).font = { bold: true };
  sheet.getRow(5).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
    cell.border = { bottom: { style: 'thin' } };
  });
  columns.forEach((c, i) => { sheet.getColumn(i + 1).width = c.width; });

  rows.forEach((row, index) => {
    sheet.addRow(columns.map((c) => {
      if (c.key === 'report_sno') return index + 1;
      if (c.key === 'visit_date' || c.key === 'visit_time') return formatIstDateTime(row.visit_date, row.visit_time).slice(c.key === 'visit_date' ? 0 : 11, c.key === 'visit_date' ? 10 : 19);
      if (c.key === 'call_date' || c.key === 'call_time') return formatIstDateTime(row.call_date, row.call_time).slice(c.key === 'call_date' ? 0 : 11, c.key === 'call_date' ? 10 : 19);
      return row[c.key] ?? '';
    }));
  });

  if (branding.report_footer) {
    const footerRowIdx = sheet.lastRow.number + 2;
    sheet.mergeCells(`A${footerRowIdx}:${endLetter}${footerRowIdx}`);
    sheet.getCell(`A${footerRowIdx}`).value = branding.report_footer;
    sheet.getCell(`A${footerRowIdx}`).font = { size: 9, italic: true, color: { argb: 'FF888888' } };
  }

  return workbook.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------
async function generatePdf({ title, columns, rows, filterLabel }) {
  const branding = await getBranding();
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape', bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  const finished = new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const logoBuffer = await loadLogoBuffer(branding.logo_path);
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, doc.page.width / 2 - 32, doc.page.margins.top, { fit: [64, 64], align: 'center' });
      doc.y = doc.page.margins.top + 70;
    } catch (err) {
      console.warn('[report] branding logo could not be rendered:', err.message);
    }
  }
  doc.fontSize(16).font('Helvetica-Bold').text(branding.org_name || 'Organization', { align: 'center' });
  const contactLine = [branding.address, branding.phone, branding.email, branding.website].filter(Boolean).join(' | ');
  if (contactLine) doc.fontSize(9).font('Helvetica').text(contactLine, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(13).font('Helvetica-Bold').text(branding.report_header || title, { align: 'center' });
  doc.fontSize(10).font('Helvetica-Bold').text(`${title} — ${filterLabel}`, { align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#666666')
    .text(`Generated (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}`, { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(1);

  const startX = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usableWidth / columns.length;
  let y = doc.y;

  function drawRow(values, opts = {}) {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 9 : 8);
    values.forEach((val, i) => {
      doc.text(String(val ?? ''), startX + i * colWidth, y, { width: colWidth - 4, ellipsis: true });
    });
    y += opts.bold ? 18 : 16;
  }

  function ensureSpace() {
    if (y > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  }

  drawRow(columns.map((c) => c.header), { bold: true });
  doc.moveTo(startX, y).lineTo(startX + usableWidth, y).stroke();
  y += 4;

  rows.forEach((row, index) => {
    row.report_sno = index + 1;
    ensureSpace();
    drawRow(columns.map((c) => {
      if (c.key === 'report_sno') return row.report_sno;
      if (c.key === 'visit_date' || c.key === 'visit_time') { const v = formatIstDateTime(row.visit_date, row.visit_time); return c.key === 'visit_date' ? v.slice(0, 10) : v.slice(11, 19); }
      if (c.key === 'call_date' || c.key === 'call_time') { const v = formatIstDateTime(row.call_date, row.call_time); return c.key === 'call_date' ? v.slice(0, 10) : v.slice(11, 19); }
      return row[c.key] ?? '';
    }));
  });

  // Page numbers and footer on every page.
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i += 1) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#888888').text(
      `${branding.report_footer || ''}   Page ${i + 1} of ${pageCount}`,
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom + 10,
      { width: usableWidth, align: 'center' }
    );
  }

  doc.end();
  return finished;
}

async function buildVisitorRows(records) {
  return records.map((r) => ({ ...r, purpose_detail_combined: combinedVisitorDetail(r) }));
}

module.exports = {
  generateExcel,
  generatePdf,
  formatFilterLabel,
  VISITOR_COLUMNS,
  CALLLOG_COLUMNS,
  buildVisitorRows
};
