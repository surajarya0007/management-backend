const { validateAdminInput, sanitizeAdminInput } = require('../models/Admin');
const { validateApiInput, sanitizeApiInput } = require('../models/Api');
const { validateUserInput, sanitizeUserInput } = require('../models/User');

// Middleware for validating Admin input
const validateAdminMiddleware = (req, res, next) => {
  const { error } = validateAdminInput(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
};

// Middleware for sanitizing Admin input
const sanitizeAdminMiddleware = (req, res, next) => {
  req.body = sanitizeAdminInput(req.body);
  next();
};

// Middleware for validating API input
const validateApiMiddleware = (req, res, next) => {
  const { error } = validateApiInput(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
};

// Middleware for sanitizing API input
const sanitizeApiMiddleware = (req, res, next) => {
  req.body = sanitizeApiInput(req.body);
  next();
};

// Middleware for validating User input
const validateUserMiddleware = (req, res, next) => {
  const { error } = validateUserInput(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
};

// Middleware for sanitizing User input
const sanitizeUserMiddleware = (req, res, next) => {
  req.body = sanitizeUserInput(req.body);
  next();
};

module.exports = {
  validateAdminMiddleware,
  sanitizeAdminMiddleware,
  validateApiMiddleware,
  sanitizeApiMiddleware,
  validateUserMiddleware,
  sanitizeUserMiddleware
};
