const express = require('express');
const router = express.Router();
const { allowlist } = require('../middleware/allowlist');
const { validateSchema } = require('../middleware/schemaValidator');
const schemas = require('../config/schemas');
const {
  getSettings,
  updateSettings,
  getCustomerLoyalty,
  adjustCustomerLoyalty,
  deleteLoyaltyEvent,
  earnPoints,
  redeemPoints,
  listEvents,
} = require('../controllers/loyaltyController');

// GET /api/loyalty/settings
router.get('/settings', getSettings);

// PUT /api/loyalty/settings
router.put('/settings', allowlist(['points_per_rupee', 'rupee_per_point', 'min_points_redeem', 'tier_config', 'redeem_options', 'is_enabled']), validateSchema(schemas.loyaltySettings), updateSettings);

// GET /api/loyalty/customer/:id (balance + event history)
router.get('/customer/:id', getCustomerLoyalty);

// POST /api/loyalty/customer/:id/adjust (manual add/deduct with note)
router.post('/customer/:id/adjust', allowlist(['points', 'event_type', 'notes', 'operation']), validateSchema(schemas.loyaltyAdjust), adjustCustomerLoyalty);

// DELETE /api/loyalty/events/:eventId (delete specific event, recalculate balance)
router.delete('/events/:eventId', deleteLoyaltyEvent);

// POST /api/loyalty/earn (internal/called when bill is paid)
router.post('/earn', allowlist(['customer_id', 'bill_id', 'points', 'notes']), validateSchema(schemas.loyaltyEarn), earnPoints);

// POST /api/loyalty/redeem (internal/called at billing)
router.post('/redeem', allowlist(['customer_id', 'bill_id', 'points', 'notes']), validateSchema(schemas.loyaltyRedeem), redeemPoints);

// GET /api/loyalty/events
router.get('/events', listEvents);

module.exports = router;
