'use strict';
const express  = require('express');
const supabase = require('../db/client');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ── GET /api/audit  (last 100 events) ────────────────────────
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const { data, error } = await supabase
      .from('audit_log')
      .select('id, username, action, entity_type, entity_id, details, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return res.json(data);

  } catch (err) {
    console.error('[audit/GET]', err.message);
    return res.status(500).json({ error: 'Failed to load audit log' });
  }
});

module.exports = router;
