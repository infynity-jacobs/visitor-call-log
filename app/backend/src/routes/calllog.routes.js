const express = require('express');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const { query, withTransaction } = require('../db/pool');
const { ValidationError } = require('../middleware/errorHandler');
const calllogService = require('../services/calllog.service');
const { requireString, validatePhone, validateDate, validateTime, validatePositiveInt, validateNonNegativeInt, validateDateFilter } = require('../utils/validators');

const router = express.Router();
router.use(authenticate);

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;
    const name = requireString(body.name, 'Name');
    const reason = requireString(body.reason, 'Reason', { maxLen: 4000 });
    const place = requireString(body.place, 'Place');
    const phone = validatePhone(body.phone, 'Phone', { optional: false });
    const callDate = validateDate(body.callDate, 'Date', { optional: true });
    const callTime = validateTime(body.callTime, 'Time', { optional: true });

    const { record, duplicate } = await calllogService.create({
      callDate, callTime, name, place, phone, reason,
      createdBy: req.user.id,
      idempotencyKey: body.idempotencyKey || null
    });

    res.status(duplicate ? 200 : 201).json({ record, duplicate });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const record = await calllogService.getById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Call log record not found.' });
    res.json({ record });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const filter = validateDateFilter(req.query);
    const limitValue = validatePositiveInt(req.query.limit, 'Limit', { defaultValue: 500, min: 1, max: 1000 });
    const offsetValue = validateNonNegativeInt(req.query.offset, 'Offset', { defaultValue: 0, max: 10000000 });
    const records = await calllogService.list({ ...filter, limit: limitValue, offset: offsetValue });
    res.json({ records });
  } catch (err) {
    next(err);
  }
});


router.delete('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid record ID.');
    const result = await withTransaction(async (client) => {
      const found = await client.query('SELECT id, name, reason FROM call_logs WHERE id = $1', [id]);
      if (!found.rows.length) return null;
      await client.query('DELETE FROM call_logs WHERE id = $1', [id]);
      await client.query('INSERT INTO audit_log (user_id, action, details) VALUES ($1, $2, $3)', [req.user.id, 'record_delete', { recordType: 'calllog', recordId: id, deletedName: found.rows[0].name }]);
      return found.rows[0];
    });
    if (!result) return res.status(404).json({ error: 'Record not found.' });
    res.json({ success: true, id });
  } catch (err) { next(err); }
});

module.exports = router;
