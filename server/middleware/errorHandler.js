const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log for debugging in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error Stack:', err.stack || err);
  }

  // Supabase / PostgreSQL unique constraint violation (duplicate key)
  if (err.code === '23505' || err.code === 11000) {
    const detail = err.detail || '';
    const message = detail ? `Duplicate entry: ${detail}` : 'A record with this unique value already exists.';
    return res.status(400).json({
      success: false,
      message
    });
  }

  // Supabase / PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist or cannot be deleted.'
    });
  }

  // Supabase / PostgreSQL invalid UUID or syntax error
  if (err.code === '22P02' || err.name === 'CastError') {
    return res.status(404).json({
      success: false,
      message: 'Resource not found or invalid ID format'
    });
  }

  // Supabase PostgREST row not found
  if (err.code === 'PGRST116') {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Validation error
  if (err.name === 'ValidationError') {
    const message = err.errors ? Object.values(err.errors).map((val) => val.message).join(', ') : err.message;
    return res.status(400).json({
      success: false,
      message
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authorization token has expired'
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
