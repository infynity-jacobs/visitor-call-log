const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { query, withTransaction } = require('../db/pool');
const { requireString } = require('../utils/validators');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Builds an Express router providing full CRUD + reorder + enable/disable
 * for a simple options table shaped like:
 *   id SERIAL, label VARCHAR, is_enabled BOOLEAN, sort_order INTEGER
 *
 * Read access requires login; write access requires admin, per spec section 11.
 */
function buildOptionsRouter(tableName) {
  const router = express.Router();
  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      const result = await query(
        `SELECT id, label, is_enabled, sort_order FROM ${tableName} ORDER BY sort_order, id`
      );
      res.json({ options: result.rows });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAdmin, async (req, res, next) => {
    try {
      const label = requireString(req.body.label, 'Label', { maxLen: 100 });
      const duplicate = await query(`SELECT 1 FROM ${tableName} WHERE LOWER(label) = LOWER($1)`, [label]);
      if (duplicate.rows.length) throw new ValidationError('An option with this label already exists.');
      const maxOrderRes = await query(`SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM ${tableName}`);
      const nextOrder = maxOrderRes.rows[0].max_order + 1;
      const result = await query(
        `INSERT INTO ${tableName} (label, sort_order) VALUES ($1, $2) RETURNING id, label, is_enabled, sort_order`,
        [label, nextOrder]
      );
      res.status(201).json({ option: result.rows[0] });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', requireAdmin, async (req, res, next) => {
    try {
      const label = requireString(req.body.label, 'Label', { maxLen: 100, optional: true });
      if (label !== null) {
        const duplicate = await query(`SELECT 1 FROM ${tableName} WHERE LOWER(label) = LOWER($1) AND id <> $2`, [label, req.params.id]);
        if (duplicate.rows.length) throw new ValidationError('An option with this label already exists.');
      }
      const isEnabled = typeof req.body.isEnabled === 'boolean' ? req.body.isEnabled : undefined;

      const sets = [];
      const params = [];
      let idx = 1;
      if (label !== null) { sets.push(`label = $${idx++}`); params.push(label); }
      if (isEnabled !== undefined) { sets.push(`is_enabled = $${idx++}`); params.push(isEnabled); }
      if (sets.length === 0) throw new ValidationError('No fields provided to update.');
      sets.push('updated_at = now()');
      params.push(req.params.id);

      const result = await query(
        `UPDATE ${tableName} SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, label, is_enabled, sort_order`,
        params
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Option not found.' });
      res.json({ option: result.rows[0] });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAdmin, async (req, res, next) => {
    try {
      const result = await query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING id`, [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Option not found.' });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Body: { orderedIds: [3, 1, 2, ...] } — sets sort_order to array position.
  router.post('/reorder', requireAdmin, async (req, res, next) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        throw new ValidationError('orderedIds must be a non-empty array.');
      }
      const ids = orderedIds.map((id) => Number(id));
      if (ids.some((id) => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
        throw new ValidationError('orderedIds must contain unique positive integer IDs.');
      }
      const existing = await query(`SELECT id FROM ${tableName} ORDER BY id`);
      const existingIds = existing.rows.map((r) => Number(r.id));
      if (ids.length !== existingIds.length || ids.some((id) => !existingIds.includes(id))) {
        throw new ValidationError('orderedIds must contain every option exactly once.');
      }
      await withTransaction(async (client) => {
        for (let i = 0; i < ids.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await client.query(`UPDATE ${tableName} SET sort_order = $1, updated_at = now() WHERE id = $2`, [i + 1, ids[i]]);
        }
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = buildOptionsRouter;
