// ─── Error Handler Middleware ─────────────────────────────────────────────────
export function errorHandler(err, req, res, next) {
  console.error(`[API Error] ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
}
