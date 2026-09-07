const express = require('express');
const { authenticate } = require('../middleware/auth');
const calllogService = require('../services/calllog.service');
const { requireString, validatePhone, validateDate, validateTime, validatePagination, validateDateFilter } = require('../utils/validators');

const router = express.Router();
router.use(authenticate);

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;
    const name = requireString(body.name, 'Name');
    const reason = requireString(body.reason, 'Reason', { maxLen: 4000 });
    const place = requireString(body.place, 'Place', { optional: true });
    const phone = validatePhone(body.phone, 'Phone', { optional: true });
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

router.get('/', async (req, res, next) => {
  try {
    const { mode = 'all', date, startDate, endDate } = req.query;
    const filter = validateDateFilter({ mode, date, startDate, endDate }, 'Date');
    const pageLimit = validatePagination(req.query.limit, 'Limit', { defaultValue: 500, min: 1, max: 1000 });
    const pageOffset = validatePagination(req.query.offset, 'Offset', { defaultValue: 0, min: 0, max: 100000000 });
    const records = await calllogService.list({ ...filter, limit: pageLimit, offset: pageOffset });
    res.json({ records });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
