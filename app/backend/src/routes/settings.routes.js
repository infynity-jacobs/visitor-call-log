const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { query } = require('../db/pool');
const { requireString, validateEmail } = require('../utils/validators');
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
    const result = await query(
      `UPDATE branding_settings SET
         org_name = $1, logo_path = $2, address = $3, phone = $4,
         email = $5, website = $6, report_header = $7, report_footer = $8,
         updated_at = now()
       WHERE id = 1 RETURNING *`,
      [orgName, b.logoPath || null, b.address || null, b.phone || null,
        b.email || null, b.website || null, b.reportHeader || null, b.reportFooter || null]
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
    const security = ['none', 'tls', 'ssl'].includes(b.security) ? b.security : null;
    if (!security) throw new ValidationError('Security must be one of: none, tls, ssl.');
    const smtpHost = requireString(b.smtpHost, 'SMTP host', { maxLen: 255, optional: true });
    const smtpPort = b.smtpPort === undefined || b.smtpPort === null || b.smtpPort === '' ? null : Number(b.smtpPort);
    if (smtpPort !== null && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
      throw new ValidationError('SMTP port must be an integer between 1 and 65535.');
    }
    const smtpUsername = requireString(b.smtpUsername, 'SMTP username', { maxLen: 255, optional: true });
    const fromEmail = validateEmail(b.fromEmail, 'From email', { optional: true });
    const fromName = requireString(b.fromName, 'From name', { maxLen: 255, optional: true });
    const encryptedPassword = b.smtpPassword ? encrypt(String(b.smtpPassword)) : undefined;

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
    const fullName = requireString(req.body.fullName, 'Full name', { optional: true });
    const role = req.body.role === 'admin' ? 'admin' : 'user';
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
    if (!Number.isSafeInteger(targetId) || targetId <= 0) throw new ValidationError('Invalid user ID.');
    if (targetId === Number(req.user.id) && req.body.isActive === false) {
      throw new ValidationError('You cannot deactivate your own account.');
    }

    if (targetId === Number(req.user.id) && req.body.role !== undefined && req.body.role !== 'admin') {
      throw new ValidationError('You cannot remove administrator access from your own account.');
    }

    const target = await query('SELECT role, is_active FROM users WHERE id = $1', [targetId]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const currentTarget = target.rows[0];
    const resultingRole = req.body.role === undefined ? currentTarget.role : req.body.role;
    const resultingActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : currentTarget.is_active;
    if (currentTarget.role === 'admin' && currentTarget.is_active && (resultingRole !== 'admin' || !resultingActive)) {
      const admins = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = true");
      if (admins.rows[0].count <= 1) throw new ValidationError('At least one active administrator is required.');
    }

    const sets = [];
    const params = [];
    let idx = 1;
    if (req.body.fullName !== undefined) { sets.push(`full_name = $${idx++}`); params.push(requireString(req.body.fullName, 'Full name', { optional: true })); }
    if (req.body.role !== undefined) {
      if (!['admin', 'user'].includes(req.body.role)) throw new ValidationError('Role must be admin or user.');
      sets.push(`role = $${idx++}`); params.push(req.body.role);
    }
    if (typeof req.body.isActive === 'boolean') { sets.push(`is_active = $${idx++}`); params.push(req.body.isActive); }
    if (req.body.password || req.body.role !== undefined || typeof req.body.isActive === 'boolean') { sets.push('session_version = session_version + 1'); }
    if (req.body.password) {
      if (req.body.password.length < 8) throw new ValidationError('Password must be at least 8 characters.');
      const hash = await bcrypt.hash(req.body.password, 10);
      sets.push(`password_hash = $${idx++}`);
      params.push(hash);
    }
    if (sets.length === 0) throw new ValidationError('No fields provided to update.');
    sets.push('updated_at = now()');
    params.push(req.params.id);

    const result = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, username, full_name, role, is_active`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: result.rows[0] });
  } catch (err) {
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
