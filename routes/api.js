const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

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
    const response = await fetch(`${PAWAPAY_API}/v2/paymentpage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAWAPAY_TOKEN}`,
      },
      body: JSON.stringify({
        depositId,
        returnUrl: `${BASE_URL}/return.html`,
        amount: String(product.price),
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

// --- Admin routes ---

// Add a new product
router.post('/products', (req, res) => {
  const { name, price, image, description } = req.body;
  if (!name || !price) {
    return res.status(400).json({ success: false, error: 'name and price are required' });
  }

  const result = db.prepare(
    'INSERT INTO products (name, price, image, description) VALUES (?, ?, ?, ?)'
  ).run(name, price, image || '', description || '');

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
