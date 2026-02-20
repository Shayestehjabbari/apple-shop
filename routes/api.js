const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'images'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage });

const router = express.Router();

const PAWAPAY_API = process.env.PAWAPAY_API || 'https://api.sandbox.pawapay.io';
const PAWAPAY_TOKEN = process.env.PAWAPAY_TOKEN || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// --- Public routes ---

// Get all products
router.get('/products', (_req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json({ success: true, data: products });
});

// Get single product
router.get('/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, data: product });
});

// Create PawaPay payment session
router.post('/pay', async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ success: false, error: 'productId is required' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const depositId = uuidv4();

  // Store payment record
  db.prepare(
    'INSERT INTO payments (depositId, productId, amount, status, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(depositId, product.id, product.price, 'pending', new Date().toISOString());

  try {
    const response = await fetch('https://sandbox.paywith.pawapay.io/api/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAWAPAY_TOKEN}`,
      },
      body: JSON.stringify({
        depositId,
        returnUrl: `${BASE_URL}/index.html`,
        amount: Number(product.price).toFixed(2),
        country: 'ZMB',
        reason: `Purchase: ${product.name}`,
      }),
    });

    const data = await response.json();

    if (data.redirectUrl) {
      res.json({ success: true, redirectUrl: data.redirectUrl });
    } else {
      res.status(502).json({ success: false, error: 'Failed to create payment session', details: data });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Payment service unavailable' });
  }
});

// PawaPay deposit callback (webhook)
router.post('/callback/deposit', (req, res) => {
  const { depositId, status } = req.body;
  if (!depositId || !status) {
    return res.status(400).json({ success: false, error: 'Invalid callback payload' });
  }

  const statusMap = {
    COMPLETED: 'completed',
    FAILED: 'failed',
    ACCEPTED: 'pending',
    PROCESSING: 'pending',
    IN_RECONCILIATION: 'pending',
  };

  const mappedStatus = statusMap[status] || 'pending';
  db.prepare('UPDATE payments SET status = ? WHERE depositId = ?').run(mappedStatus, depositId);

  res.json({ success: true });
});

// Check deposit status from PawaPay
router.get('/payments/:depositId/status', async (req, res) => {
  const { depositId } = req.params;

  try {
    const response = await fetch(`${PAWAPAY_API}/v2/deposits/${depositId}`, {
      headers: { 'Authorization': `Bearer ${PAWAPAY_TOKEN}` },
    });
    const data = await response.json();

    if (data.status === 'FOUND' && data.data) {
      const statusMap = {
        COMPLETED: 'completed',
        FAILED: 'failed',
        ACCEPTED: 'pending',
        PROCESSING: 'pending',
        IN_RECONCILIATION: 'pending',
      };
      const mappedStatus = statusMap[data.data.status] || 'pending';
      db.prepare('UPDATE payments SET status = ? WHERE depositId = ?').run(mappedStatus, depositId);

      res.json({ success: true, status: mappedStatus, pawapayStatus: data.data.status });
    } else {
      res.status(404).json({ success: false, error: 'Deposit not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not check payment status' });
  }
});

// --- Admin routes ---

// Add a new product
router.post('/products', upload.single('image'), (req, res) => {
  const { name, price, description } = req.body;
  if (!name || !price) {
    return res.status(400).json({ success: false, error: 'name and price are required' });
  }

  const image = req.file ? `/images/${req.file.filename}` : '';

  const result = db.prepare(
    'INSERT INTO products (name, price, image, description) VALUES (?, ?, ?, ?)'
  ).run(name, price, image, description || '');

  res.json({ success: true, data: { id: result.lastInsertRowid } });
});

// Delete a product
router.delete('/products/:id', (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true });
});

// Get all payments (admin)
router.get('/payments', (_req, res) => {
  const payments = db.prepare(`
    SELECT p.*, pr.name as productName
    FROM payments p
    LEFT JOIN products pr ON pr.id = p.productId
    ORDER BY p.id DESC
  `).all();
  res.json({ success: true, data: payments });
});

module.exports = router;
