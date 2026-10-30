'use strict';
const express  = require('express');
const { body, param, validationResult } = require('express-validator');
const supabase = require('../db/client');
const { requireAuth } = require('../middleware/auth');
const { logAudit }    = require('./auth');

const router = express.Router();

// ── Shared validator chains ───────────────────────────────────
const productFields = [
  body('emoji').optional().trim().isLength({ max: 10 }),
  body('name').trim().isLength({ min: 1, max: 200 }).escape(),
  body('sub').optional().trim().isLength({ max: 300 }).escape(),
  body('category')
    .trim()
    .isIn(['bouquets', 'plants', 'gifts', 'wedding']),
  body('price').optional().trim().isLength({ max: 100 }).escape(),
  body('badge').optional().trim().isLength({ max: 100 }).escape(),
  body('badge_style').optional().isIn(['forest', 'gold', 'rose']),
  body('available').optional().isBoolean().toBoolean(),
  body('fresh').optional().isBoolean().toBoolean(),
  body('sort_order').optional().isInt({ min: 0 }).toInt()
];

function validate(req, res, next) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errs.array() });
  }
  next();
}

// ── GET /api/products  (public — only available products) ─────
router.get('/', async (req, res) => {
  try {
    const showAll = req.query.all === '1';   // admin uses ?all=1 (still authenticated below)

    let query = supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!showAll) {
      query = query.eq('available', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data);

  } catch (err) {
    console.error('[products/GET]', err.message);
    return res.status(500).json({ error: 'Failed to load products' });
  }
});

// ── Everything below requires authentication ──────────────────
router.use(requireAuth);

// ── POST /api/products ────────────────────────────────────────
router.post('/', productFields, validate, async (req, res) => {
  const { emoji='💐', name, sub, category, price, badge, badge_style='forest',
          available=true, fresh=true, sort_order=0 } = req.body;
  try {
    const { data, error } = await supabase
      .from('products')
      .insert({ emoji, name, sub, category, price, badge, badge_style,
                available, fresh, sort_order })
      .select()
      .single();
    if (error) throw error;

    await logAudit(req.user.sub, req.user.username, 'PRODUCT_CREATE',
      'product', data.id, { name }, req);

    return res.status(201).json(data);

  } catch (err) {
    console.error('[products/POST]', err.message);
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

// ── PATCH /api/products/:id ───────────────────────────────────
router.patch(
  '/:id',
  [param('id').isUUID(), ...productFields],
  validate,
  async (req, res) => {
    const { id } = req.params;
    // Only apply the fields that were actually sent
    const allowed = ['emoji','name','sub','category','price','badge',
                     'badge_style','available','fresh','sort_order'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Product not found' });

      await logAudit(req.user.sub, req.user.username, 'PRODUCT_UPDATE',
        'product', id, { fields: Object.keys(updates) }, req);

      return res.json(data);

    } catch (err) {
      console.error('[products/PATCH]', err.message);
      return res.status(500).json({ error: 'Failed to update product' });
    }
  }
);

// ── DELETE /api/products/:id ──────────────────────────────────
router.delete(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    const { id } = req.params;
    try {
      // Fetch name for audit log before deleting
      const { data: prod } = await supabase
        .from('products').select('name').eq('id', id).maybeSingle();

      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;

      await logAudit(req.user.sub, req.user.username, 'PRODUCT_DELETE',
        'product', id, { name: prod?.name }, req);

      return res.json({ ok: true });

    } catch (err) {
      console.error('[products/DELETE]', err.message);
      return res.status(500).json({ error: 'Failed to delete product' });
    }
  }
);

// ── POST /api/products/mark-all-fresh ────────────────────────
router.post('/mark-all-fresh', async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .update({ fresh: true, available: true })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // update all

    if (error) throw error;

    await logAudit(req.user.sub, req.user.username,
      'MARK_ALL_FRESH', 'product', null, null, req);

    return res.json({ ok: true });

  } catch (err) {
    console.error('[products/mark-all-fresh]', err.message);
    return res.status(500).json({ error: 'Failed to mark fresh' });
  }
});

module.exports = router;
