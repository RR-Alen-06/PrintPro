const express = require('express');
const router = express.Router();
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
router.put('/settings', updateSettings);

// GET /api/loyalty/customer/:id (balance + event history)
router.get('/customer/:id', getCustomerLoyalty);

// POST /api/loyalty/customer/:id/adjust (manual add/deduct with note)
router.post('/customer/:id/adjust', adjustCustomerLoyalty);

// DELETE /api/loyalty/events/:eventId (delete specific event, recalculate balance)
router.delete('/events/:eventId', deleteLoyaltyEvent);

// POST /api/loyalty/earn (internal/called when bill is paid)
router.post('/earn', earnPoints);

// POST /api/loyalty/redeem (internal/called at billing)
router.post('/redeem', redeemPoints);

// GET /api/loyalty/events
router.get('/events', listEvents);

module.exports = router;
