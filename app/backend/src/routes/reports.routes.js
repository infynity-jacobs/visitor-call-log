const express = require('express');
const { authenticate } = require('../middleware/auth');
const visitorsService = require('../services/visitors.service');
const reportService = require('../services/report.service');
const emailService = require('../services/email.service');
const { validateEmail, requireString, validateDateFilter } = require('../utils/validators');
const { ValidationError } = require('../middleware/errorHandler');

const router = express.Router();
router.use(authenticate);

async function loadDataset(type, filterParams, userRole) {
  if (type === 'visitors') {
    const records = await visitorsService.list({ ...filterParams, limit: 100000, offset: 0 });
    return {
      rows: await reportService.buildVisitorRows(records),
      columns: reportService.VISITOR_COLUMNS
    };
  }

  // Keep the historical API key "calllog" for compatibility, but
  // report the current PBX CDR dataset instead of the archived manual log.
  if (type === 'calllog' || type === 'pbx') {
    const rows = await reportService.buildPbxRows(filterParams, userRole);
    return {
      rows,
      columns: reportService.PBX_COLUMNS
    };
  }

  throw new ValidationError('Unknown report type. Use "visitors" or "calllog".');
}

function titleFor(type) {
  return type === 'visitors' ? 'Visitors Register Report' : 'PBX CDR Report';
}

router.get('/:type/records', async (req, res, next) => {
  try {
    const filter = validateDateFilter(req.query);
    const { rows, columns } = await loadDataset(req.params.type, filter, req.user?.role);
    res.json({ type: req.params.type, filter, columns: columns.map((c) => c.header), records: rows.map((r, index) => ({ ...r, report_sno: index + 1 })) });
  } catch (err) { next(err); }
});

router.get('/:type/:format', async (req, res, next) => {
  try {
    const { type, format } = req.params;
    const filter = validateDateFilter(req.query);
    const { rows, columns } = await loadDataset(type, filter, req.user?.role);
    const filterLabel = reportService.formatFilterLabel(filter);
    const title = titleFor(type);

    if (format === 'xlsx') {
      const buffer = await reportService.generateExcel({ title, columns, rows, filterLabel });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report.xlsx"`);
      return res.send(buffer);
    }
    if (format === 'pdf') {
      const buffer = await reportService.generatePdf({ title, columns, rows, filterLabel });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report.pdf"`);
      return res.send(buffer);
    }
    throw new ValidationError('Unknown report format. Use "xlsx" or "pdf".');
  } catch (err) {
    next(err);
  }
});

router.post('/:type/email', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { format = 'pdf', to, subject, message } = req.body;
    const filter = validateDateFilter(req.body);

    const recipient = validateEmail(to, 'Recipient email', { optional: false });
    const emailSubject = requireString(subject, 'Subject', { optional: true }) || titleFor(type);

    const { rows, columns } = await loadDataset(type, filter, req.user?.role);
    const filterLabel = reportService.formatFilterLabel(filter);
    const title = titleFor(type);

    if (!['pdf', 'xlsx'].includes(format)) throw new ValidationError('Unknown report format. Use "pdf" or "xlsx".');

    let buffer; let filename; let contentType;
    if (format === 'xlsx') {
      buffer = await reportService.generateExcel({ title, columns, rows, filterLabel });
      filename = `${type}-report.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      buffer = await reportService.generatePdf({ title, columns, rows, filterLabel });
      filename = `${type}-report.pdf`;
      contentType = 'application/pdf';
    }

    await emailService.sendMail({
      to: recipient,
      subject: emailSubject,
      text: message || `Please find attached the ${title} (${filterLabel}).`,
      attachments: [{ filename, content: buffer, contentType }]
    });

    res.json({ success: true, message: `Report emailed to ${recipient}.` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
