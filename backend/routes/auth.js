'use strict';
const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const supabase  = require('../db/client');
const { loginLimiter }  = require('../middleware/rateLimiter');
const { requireAuth }   = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,       // JS cannot read this cookie
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   60 * 60 * 1000  // 1 hour (matches JWT)
};

// ── POST /api/auth/login ──────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  [
    body('username').trim().isLength({ min: 1, max: 50 }).escape(),
    body('password').isLength({ min: 1, max: 200 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Generic message — don't hint at which field failed
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const { username, password } = req.body;

    try {
      // Fetch user by username
      const { data: user, error } = await supabase
        .from('admin_users')
        .select('id, username, password_hash, role, is_active')
        .eq('username', username)
        .maybeSingle();

      if (error) throw error;

      // Constant-time comparison regardless of whether user exists
      const dummyHash = '$2a$12$invalidhashfortimingprotectiononly00000000000000000000';
      const hashToCompare = user ? user.password_hash : dummyHash;
      const passwordMatch  = await bcrypt.compare(password, hashToCompare);

      if (!user || !passwordMatch || !user.is_active) {
        await logAudit(null, null, 'LOGIN_FAIL', null, null,
          { attempted_username: username }, req);
        // Same response for wrong user, wrong password, or inactive account
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Sign JWT
      const token = jwt.sign(
        { sub: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h', algorithm: 'HS256' }
      );

      // Record last login (non-blocking)
      supabase.from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {});

      await logAudit(user.id, user.username, 'LOGIN_SUCCESS', null, null, null, req);

      res.cookie('nasmat_token', token, COOKIE_OPTS);
      return res.json({
        ok: true,
        user: { username: user.username, role: user.role }
      });

    } catch (err) {
      console.error('[auth/login]', err.message);
      return res.status(500).json({ error: 'Server error. Please try again.' });
    }
  }
);

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  await logAudit(req.user.sub, req.user.username, 'LOGOUT', null, null, null, req);
  res.clearCookie('nasmat_token', { ...COOKIE_OPTS, maxAge: 0 });
  return res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    username: req.user.username,
    role: req.user.role
  });
});

// ── Shared audit log helper ───────────────────────────────────
async function logAudit(userId, username, action, entityType, entityId, details, req) {
  try {
    await supabase.from('audit_log').insert({
      user_id:     userId     || null,
      username:    username   || null,
      action,
      entity_type: entityType || null,
      entity_id:   entityId   || null,
      details:     details    || null,
      ip_address:  req.ip     || null,
      user_agent:  req.get('user-agent') || null
    });
  } catch (e) {
    console.error('[audit]', e.message);
  }
}

module.exports = router;
module.exports.logAudit = logAudit;
