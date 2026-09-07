const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../db/pool');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const result = await query(
      'SELECT id, username, full_name, role, is_active FROM users WHERE id = $1',
      [payload.id]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Your account is inactive or no longer exists. Please log in again.' });
    }
    req.user = { id: user.id, username: user.username, fullName: user.full_name, role: user.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Administrator access required.' });
  }
  return next();
}

module.exports = { authenticate, requireAdmin, requireSuperAdmin };
