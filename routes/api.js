const express = require('express');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const fs = require('fs');

const imagesDir = process.env.DATA_DIR
  ? path.join(path.resolve(process.env.DATA_DIR), 'images')
  : path.join(__dirname, '..', 'data', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: imagesDir,
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

// Get single product (with gallery images)
router.get('/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  const images = db.prepare('SELECT * FROM product_images WHERE productId = ? ORDER BY sortOrder').all(req.params.id);
  product.images = images;
  res.json({ success: true, data: product });
});

// Create PawaPay payment session
router.post('/pay', async (req, res) => {
  const { productId, customer } = req.body;
  if (!productId) {
    return res.status(400).json({ success: false, error: 'productId is required' });
  }

  if (!customer || !customer.name || !customer.phone || !customer.email || !customer.address || !customer.city) {
    return res.status(400).json({ success: false, error: 'All customer fields are required (name, phone, email, address, city)' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  if (product.stock <= 0) {
    return res.status(400).json({ success: false, error: 'Out of stock' });
  }

  // Decrement stock
  db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ?').run(productId);

  const depositId = uuidv4();

  // Store payment record with customer data
  db.prepare(
    'INSERT INTO payments (depositId, productId, amount, status, createdAt, customerName, customerPhone, customerEmail, customerAddress, customerCity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(depositId, product.id, product.price, 'pending', new Date().toISOString(), customer.name, customer.phone, customer.email, customer.address, customer.city);

  try {
    const response = await fetch('https://sandbox.paywith.pawapay.io/api/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAWAPAY_TOKEN}`,
      },
      body: JSON.stringify({
        depositId,
        returnUrl: `${BASE_URL}/return.html?depositId=${depositId}`,
        amount: Number(product.price).toFixed(2),
        country: 'ZMB',
        reason: `Purchase: ${product.name} — ${customer.name}`,
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
router.post('/products', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), (req, res) => {
  const { name, description, category } = req.body;
  const price = parseFloat(req.body.price);
  const stock = parseInt(req.body.stock, 10) || 0;
  if (!name || isNaN(price)) {
    return res.status(400).json({ success: false, error: 'name and price are required' });
  }

  const imageFile = req.files && req.files['image'] && req.files['image'][0];
  const image = imageFile ? `/images/${imageFile.filename}` : '';

  const result = db.prepare(
    'INSERT INTO products (name, price, image, description, stock, category) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, price, image, description || '', stock, category || '');

  // Insert gallery images
  const galleryFiles = req.files && req.files['gallery'] || [];
  const insertImage = db.prepare('INSERT INTO product_images (productId, imagePath, sortOrder) VALUES (?, ?, ?)');
  for (let i = 0; i < galleryFiles.length; i++) {
    insertImage.run(result.lastInsertRowid, `/images/${galleryFiles[i].filename}`, i);
  }

  res.json({ success: true, data: { id: result.lastInsertRowid } });
});

// Update a product
router.put('/products/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const { name, description, category } = req.body;
  const price = parseFloat(req.body.price);
  const stock = parseInt(req.body.stock, 10);
  if (!name || isNaN(price)) {
    return res.status(400).json({ success: false, error: 'name and price are required' });
  }

  const imageFile = req.files && req.files['image'] && req.files['image'][0];
  const image = imageFile ? `/images/${imageFile.filename}` : product.image;
  const finalStock = isNaN(stock) ? product.stock : stock;

  db.prepare(
    'UPDATE products SET name = ?, price = ?, image = ?, description = ?, stock = ?, category = ? WHERE id = ?'
  ).run(name, price, image, description || '', finalStock, category || '', req.params.id);

  // Insert new gallery images
  const galleryFiles = req.files && req.files['gallery'] || [];
  if (galleryFiles.length > 0) {
    const maxSort = db.prepare('SELECT COALESCE(MAX(sortOrder), -1) as m FROM product_images WHERE productId = ?').get(req.params.id).m;
    const insertImage = db.prepare('INSERT INTO product_images (productId, imagePath, sortOrder) VALUES (?, ?, ?)');
    for (let i = 0; i < galleryFiles.length; i++) {
      insertImage.run(req.params.id, `/images/${galleryFiles[i].filename}`, maxSort + 1 + i);
    }
  }

  res.json({ success: true });
});

// Delete a product
router.delete('/products/:id', (req, res) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true });
});

// Get single payment with product info
router.get('/payments/:depositId', (req, res) => {
  const { depositId } = req.params;
  const payment = db.prepare(`
    SELECT p.*, pr.name as productName, pr.image as productImage
    FROM payments p
    LEFT JOIN products pr ON pr.id = p.productId
    WHERE p.depositId = ?
  `).get(depositId);
  if (!payment) {
    return res.status(404).json({ success: false, error: 'Payment not found' });
  }
  res.json({ success: true, data: payment });
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

// Order history by phone
router.get('/orders', (req, res) => {
  const phone = req.query.phone;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'phone query parameter is required' });
  }
  const orders = db.prepare(`
    SELECT p.*, pr.name as productName, pr.image as productImage
    FROM payments p
    LEFT JOIN products pr ON pr.id = p.productId
    WHERE p.customerPhone = ?
    ORDER BY p.id DESC
  `).all(phone);
  res.json({ success: true, data: orders });
});

// Admin dashboard stats
router.get('/admin/stats', (_req, res) => {
  const products = db.prepare('SELECT COUNT(*) as total, COALESCE(SUM(stock), 0) as totalStock FROM products').get();
  const outOfStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock = 0').get().count;
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock > 0 AND stock < 5').get().count;
  const revenue = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'").get().total;
  const pending = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'").get().count;
  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;

  res.json({
    success: true,
    data: {
      totalProducts: products.total,
      totalStock: products.totalStock,
      outOfStock,
      lowStock,
      revenue,
      pendingOrders: pending,
      totalOrders,
    },
  });
});

// Delete a gallery image
router.delete('/product-images/:id', (req, res) => {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ?').get(req.params.id);
  if (!img) {
    return res.status(404).json({ success: false, error: 'Image not found' });
  }
  // Remove file from disk
  const filePath = path.join(imagesDir, path.basename(img.imagePath));
  try { fs.unlinkSync(filePath); } catch {}
  db.prepare('DELETE FROM product_images WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
