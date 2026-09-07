const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { query } = require('../db/pool');
const { requireString, validateEmail, validatePositiveInt, validatePhone } = require('../utils/validators');
const { ValidationError } = require('../middleware/errorHandler');
const { encrypt } = require('../utils/crypto');
const emailService = require('../services/email.service');
const config = require('../config');

const router = express.Router();
router.use(authenticate);

// ---------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------
router.get('/branding', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM branding_settings WHERE id = 1');
    res.json({ branding: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/branding', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body;
    const orgName = requireString(b.orgName, 'Organization Name', { maxLen: 255 });
    const email = validateEmail(b.email, 'Email', { optional: true });
    const phone = validatePhone(b.phone, 'Phone', { optional: true });
    const website = b.website ? requireString(b.website, 'Website', { maxLen: 255 }) : null;
    const reportHeader = b.reportHeader ? requireString(b.reportHeader, 'Report Header', { maxLen: 500 }) : null;
    const reportFooter = b.reportFooter ? requireString(b.reportFooter, 'Report Footer', { maxLen: 500 }) : null;
    const logoPosition = ['left', 'right'].includes(b.logoPosition) ? b.logoPosition : 'left';
    const result = await query(
      `UPDATE branding_settings SET
         org_name = $1, logo_path = $2, address = $3, phone = $4,
         email = $5, website = $6, report_header = $7, report_footer = $8, logo_position = $9,
         updated_at = now()
       WHERE id = 1 RETURNING *`,
      [orgName, b.logoPath || null, b.address || null, phone,
        email, website, reportHeader, reportFooter, logoPosition]
    );
    res.json({ branding: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------
// SMTP
// ---------------------------------------------------------------------
router.get('/smtp', requireAdmin, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, smtp_host, smtp_port, security, smtp_username, from_email, from_name, updated_at FROM smtp_settings WHERE id = 1'
    );
    // Password is intentionally never returned to the client.
    res.json({ smtp: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.put('/smtp', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body;
    const security = ['none', 'tls', 'ssl'].includes(b.security) ? b.security : (() => { throw new ValidationError('Security must be one of: none, tls, ssl.'); })();
    const smtpPort = b.smtpPort === undefined || b.smtpPort === null || b.smtpPort === '' ? null : validatePositiveInt(b.smtpPort, 'SMTP Port', { min: 1, max: 65535 });
    const fromEmail = validateEmail(b.fromEmail, 'From email', { optional: true });
    const smtpHost = b.smtpHost ? requireString(b.smtpHost, 'SMTP Host', { maxLen: 255 }) : null;
    const smtpUsername = b.smtpUsername ? requireString(b.smtpUsername, 'SMTP Username', { maxLen: 255 }) : null;
    const fromName = b.fromName ? requireString(b.fromName, 'From name', { maxLen: 255 }) : null;
    const encryptedPassword = b.smtpPassword ? encrypt(b.smtpPassword) : undefined;

    const sets = [
      'smtp_host = $1', 'smtp_port = $2', 'security = $3',
      'smtp_username = $4', 'from_email = $5', 'from_name = $6', 'updated_at = now()'
    ];
    const params = [
      smtpHost, smtpPort, security, smtpUsername, fromEmail, fromName
    ];
    if (encryptedPassword !== undefined) {
      sets.push(`smtp_password_enc = $${params.length + 1}`);
      params.push(encryptedPassword);
    }

    const result = await query(
      `UPDATE smtp_settings SET ${sets.join(', ')} WHERE id = 1 RETURNING id, smtp_host, smtp_port, security, smtp_username, from_email, from_name`,
      params
    );
    res.json({ smtp: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/smtp/test', requireAdmin, async (req, res, next) => {
  try {
    const to = validateEmail(req.body.to, 'Test recipient email', { optional: false });
    await emailService.sendTestEmail(to);
    res.json({ success: true, message: `Test email sent to ${to}.` });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------
// Users (admin only)
// ---------------------------------------------------------------------
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const result = await query('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id');
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/users', requireAdmin, async (req, res, next) => {
  try {
    const username = requireString(req.body.username, 'Username', { maxLen: 100 });
    const password = requireString(req.body.password, 'Password');
    const fullName = requireString(req.body.fullName, 'Full name', { maxLen: 255, optional: true });
    if (!['super_admin', 'admin', 'user'].includes(req.body.role)) throw new ValidationError('Role must be super_admin, admin or user.');
    const role = req.body.role;
    if (role === 'super_admin' && req.user.role !== 'super_admin') throw new ValidationError('Only a Super Administrator can create a Super Administrator account.');
    if (password.length < 8) throw new ValidationError('Password must be at least 8 characters.');

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role, is_active',
      [username, hash, fullName, role]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists.' });
    next(err);
  }
});

router.put('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isSafeInteger(targetId) || targetId < 1) throw new ValidationError('Invalid user ID.');
    const targetRes = await query('SELECT id, role, is_active FROM users WHERE id = $1', [targetId]);
    if (!targetRes.rows.length) return res.status(404).json({ error: 'User not found.' });
    const target = targetRes.rows[0];
    if (targetId === Number(req.user.id) && req.body.isActive === false) throw new ValidationError('You cannot deactivate your own administrator account.');
    if (target.role === 'super_admin' && req.user.role !== 'super_admin' && (req.body.role !== undefined || req.body.isActive !== undefined)) throw new ValidationError('Only a Super Administrator can modify a Super Administrator account.');
    if (req.body.role === 'super_admin' && req.user.role !== 'super_admin') throw new ValidationError('Only a Super Administrator can assign the Super Administrator role.');
    if (!['super_admin', 'admin', 'user'].includes(req.body.role || target.role)) throw new ValidationError('Role must be super_admin, admin or user.');
    const resultingRole = req.body.role === undefined ? target.role : req.body.role;
    const resultingActive = req.body.isActive === undefined ? target.is_active : req.body.isActive;
    if (['admin','super_admin'].includes(target.role) && (!resultingActive || resultingRole === 'user')) {
      const admins = await query("SELECT COUNT(*)::int AS count FROM users WHERE role IN ('admin','super_admin') AND is_active = true AND id <> $1", [targetId]);
      if (admins.rows[0].count === 0) throw new ValidationError('At least one active administrator account must remain.');
    }
    if (target.role === 'super_admin' && (resultingRole !== 'super_admin' || !resultingActive)) {
      const supers = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'super_admin' AND is_active = true AND id <> $1", [targetId]);
      if (supers.rows[0].count === 0) throw new ValidationError('At least one active Super Administrator account must remain.');
    }
    const sets = [], params = []; let idx = 1;
    if (req.body.username !== undefined) { sets.push(`username = $${idx++}`); params.push(requireString(req.body.username, 'Username', { maxLen: 100 })); }
    if (req.body.fullName !== undefined) { sets.push(`full_name = $${idx++}`); params.push(requireString(req.body.fullName, 'Full name', { maxLen: 255 })); }
    if (req.body.role !== undefined) { sets.push(`role = $${idx++}`); params.push(req.body.role); }
    if (typeof req.body.isActive === 'boolean') { sets.push(`is_active = $${idx++}`); params.push(req.body.isActive); }
    if (req.body.password) { if (req.body.password.length < 8) throw new ValidationError('Password must be at least 8 characters.'); const hash = await bcrypt.hash(req.body.password, 10); sets.push(`password_hash = $${idx++}`); params.push(hash); }
    if (sets.length === 0) throw new ValidationError('No fields provided to update.');
    sets.push('updated_at = now()'); params.push(targetId);
    const result = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, username, full_name, role, is_active`, params);
    res.json({ user: result.rows[0] });
  } catch (err) { if (err.code === '23505') return res.status(409).json({ error: 'Username already exists.' }); next(err); }
});

router.delete('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isSafeInteger(targetId) || targetId < 1) throw new ValidationError('Invalid user ID.');
    if (targetId === Number(req.user.id)) throw new ValidationError('You cannot delete your own administrator account.');

    const target = await query('SELECT id, role, is_active FROM users WHERE id = $1', [targetId]);
    if (!target.rows.length) return res.status(404).json({ error: 'User not found.' });

    if (target.rows[0].role === 'super_admin' && req.user.role !== 'super_admin') throw new ValidationError('Only a Super Administrator can delete a Super Administrator account.');

    if (['admin', 'super_admin'].includes(target.rows[0].role) && target.rows[0].is_active) {
      const admins = await query("SELECT COUNT(*)::int AS count FROM users WHERE role IN ('admin','super_admin') AND is_active = true AND id <> $1", [targetId]);
      if (admins.rows[0].count === 0) throw new ValidationError('At least one active administrator account must remain.');
    }

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id, username', [targetId]);
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return next(new ValidationError('This user cannot be deleted because historical records reference the account.'));
    next(err);
  }
});

// ---------------------------------------------------------------------
// Application version
// ---------------------------------------------------------------------
router.get('/version', (req, res) => {
  res.json({ version: config.version });
});

module.exports = router;
