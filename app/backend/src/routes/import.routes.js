const express = require('express');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');
const importService = require('../services/import.service');

const router = express.Router();
router.use(authenticate, requireSuperAdmin);

function decode(body) {
  if (!body || !body.fileBase64) throw new ValidationError('Excel file is required.');
  if (typeof body.fileBase64 !== 'string') throw new ValidationError('Invalid Excel file payload.');
  const buffer = Buffer.from(body.fileBase64, 'base64');
  if (!buffer.length) throw new ValidationError('Uploaded Excel file is empty.');
  if (buffer.length > importService.MAX_FILE_BYTES) throw new ValidationError('Excel file is too large. Maximum size is 8 MB.');
  return buffer;
}

function validateType(type) {
  if (!['visitors', 'calllog'].includes(type)) throw new ValidationError('Invalid import type.');
}

router.get('/batches', async (req, res, next) => {
  try {
    res.json(await importService.listBatches({ limit: req.query.limit }));
  } catch (err) { next(err); }
});

router.post('/preview', async (req, res, next) => {
  try {
    const type = req.body.type;
    validateType(type);
    const filename = req.body.filename || 'upload.xlsx';
    res.json(await importService.preview({ buffer: decode(req.body), type, filename }));
  } catch (err) { next(err); }
});

router.post('/commit', async (req, res, next) => {
  try {
    const type = req.body.type;
    validateType(type);
    const filename = req.body.filename || 'upload.xlsx';
    res.json(await importService.importWorkbook({ buffer: decode(req.body), type, filename, userId: req.user.id }));
  } catch (err) { next(err); }
});

module.exports = router;
