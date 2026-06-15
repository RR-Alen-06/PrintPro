require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const customerRoutes = require('./routes/customers');
const billRoutes = require('./routes/bills');
const paymentRoutes = require('./routes/payments');
const inventoryRoutes = require('./routes/inventory');
const purchaseRoutes = require('./routes/purchases');
const reportRoutes = require('./routes/reports');
const profileRoutes = require('./routes/profile');
const notificationRoutes = require('./routes/notifications');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (logos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/customers', customerRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'PrintPro API is running', timestamp: new Date().toISOString() });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`[OK] PrintPro API server running on port ${PORT}`);
      console.log(`[INFO] API base URL: http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('[ERROR] Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
