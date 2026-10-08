const { app } = require('./server/server');

module.exports = (req, res) => {
  // Ensure req.url starts with /api if incoming path was stripped or rewritten
  if (
    req.url &&
    !req.url.startsWith('/api') &&
    (req.url.startsWith('/auth') ||
      req.url.startsWith('/tasks') ||
      req.url.startsWith('/categories') ||
      req.url.startsWith('/notifications') ||
      req.url.startsWith('/health'))
  ) {
    req.url = '/api' + req.url;
  }
  return app(req, res);
};
