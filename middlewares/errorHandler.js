export const notFoundHandler = (req, res, _next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl} is not a valid endpoint.`,
    code: 'ROUTE_NOT_FOUND'
  });
};

export const globalErrorHandler = (err, _req, res, _next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ success: false, message });
};



