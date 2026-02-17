const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// Get all products (optional ?category=iPhone filter)
router.get('/products', (req, res) => {
  const { category } = req.query;
  let products;
  if (category) {
    products = db.prepare('SELECT * FROM products WHERE category = ?').all(category);
  } else {
    products = db.prepare('SELECT * FROM products').all();
  }
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

// Get categories
router.get('/categories', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  res.json({ success: true, data: rows.map(r => r.category) });
});

// Place order
router.post('/orders', (req, res) => {
  const { customerName, customerEmail, items } = req.body;

  if (!customerName || !customerEmail || !items || !items.length) {
    return res.status(400).json({
      success: false,
      error: 'customerName, customerEmail, and items are required',
    });
  }

  // Validate items and calculate total
  let total = 0;
  const resolvedItems = [];

  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
    if (!product) {
      return res.status(400).json({
        success: false,
        error: `Product ID ${item.productId} not found`,
      });
    }
    const qty = item.quantity || 1;
    total += product.price * qty;
    resolvedItems.push({ productId: product.id, quantity: qty, price: product.price });
  }

  const insertOrder = db.prepare(
    'INSERT INTO orders (customerName, customerEmail, total, createdAt) VALUES (?, ?, ?, ?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO order_items (orderId, productId, quantity, price) VALUES (?, ?, ?, ?)'
  );

  const placeOrder = db.transaction(() => {
    const result = insertOrder.run(customerName, customerEmail, total, new Date().toISOString());
    const orderId = result.lastInsertRowid;
    for (const ri of resolvedItems) {
      insertItem.run(orderId, ri.productId, ri.quantity, ri.price);
    }
    return orderId;
  });

  const orderId = placeOrder();

  res.json({
    success: true,
    data: { orderId, total, itemCount: resolvedItems.length },
  });
});

// Get orders
router.get('/orders', (_req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  res.json({ success: true, data: orders });
});

// Get order detail
router.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }
  const items = db.prepare(`
    SELECT oi.*, p.name, p.category
    FROM order_items oi
    JOIN products p ON p.id = oi.productId
    WHERE oi.orderId = ?
  `).all(req.params.id);
  res.json({ success: true, data: { ...order, items } });
});

module.exports = router;
