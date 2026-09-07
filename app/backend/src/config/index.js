require('dotenv').config();

function required(name, fallback) {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: required('DB_NAME', 'visitor_call_log'),
    user: required('DB_USER', 'vcl_app'),
    password: required('DB_PASSWORD', ''),
    ssl: process.env.DB_SSL === 'true'
  },

  jwt: {
    secret: required('JWT_SECRET', 'change-me-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '12h'
  },

  // Used to symmetrically encrypt the SMTP password before it is stored,
  // so it is never persisted in plain text.
  appSecretKey: required('APP_SECRET_KEY', 'change-me-in-production-32-bytes!'),

  corsOrigin: process.env.CORS_ORIGIN || '*',

  uploadsDir: process.env.UPLOADS_DIR || './uploads',

  version: process.env.APP_VERSION || '1.0.1'
};
