const express = require('express');
const { authenticate } = require('../middleware/auth');
const searchService = require('../services/search.service');
const { requireString, validatePositiveInt } = require('../utils/validators');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const q = requireString(req.query.q, 'Search text', { maxLen: 200 });
    const limit = validatePositiveInt(req.query.limit, 'Limit', { defaultValue: 100, min: 1, max: 200 });
    const results = await searchService.search(q, limit);
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
