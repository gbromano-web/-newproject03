'use strict';
const jwt = require('jsonwebtoken');

/**
 * Verifies the JWT from the httpOnly cookie.
 * Attaches decoded payload to req.user on success.
 */
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.nasmat_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, username, role, iat, exp }
    next();
  } catch (err) {
    // Don't reveal whether token is expired vs. invalid
    res.clearCookie('nasmat_token');
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = { requireAuth };
