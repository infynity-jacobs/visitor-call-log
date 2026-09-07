// Centralized error handler. Keeps technical details out of client responses
// while logging full detail server-side for troubleshooting.

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  // eslint-disable-next-line no-console
  console.error(`[error] ${req.method} ${req.originalUrl} ->`, err);

  const isValidation = err.name === 'ValidationError';
  const message = isValidation
    ? err.message
    : status === 500
      ? 'An unexpected error occurred. Please try again or contact your administrator.'
      : err.message || 'Request failed.';

  res.status(isValidation ? 400 : status).json({ error: message });
}

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

module.exports = { errorHandler, AppError, ValidationError };
