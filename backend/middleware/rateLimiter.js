'use strict';
const rateLimit = require('express-rate-limit');

/**
 * Strict rate limit for the login endpoint.
 * 5 attempts per IP per 15 minutes, then locked out.
 * Uses a standard 429 with Retry-After header.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failures
  message: {
    error: 'Too many login attempts. Please wait 15 minutes and try again.'
  }
});

/**
 * General API rate limit — 200 req / 15 min per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});

module.exports = { loginLimiter, apiLimiter };
