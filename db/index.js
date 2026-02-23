const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'shop.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    depositId TEXT NOT NULL UNIQUE,
    productId INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt TEXT NOT NULL,
    customerName TEXT,
    customerPhone TEXT,
    customerEmail TEXT,
    customerAddress TEXT,
    customerCity TEXT,
    FOREIGN KEY (productId) REFERENCES products(id)
  );
`);

// Migration: add customer columns to existing payments table
const cols = db.prepare("PRAGMA table_info(payments)").all().map(c => c.name);
const newCols = ['customerName', 'customerPhone', 'customerEmail', 'customerAddress', 'customerCity'];
for (const col of newCols) {
  if (!cols.includes(col)) {
    db.exec(`ALTER TABLE payments ADD COLUMN ${col} TEXT`);
  }
}

// Migration: add stock column to products table
const productCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
if (!productCols.includes('stock')) {
  db.exec("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0");
}
if (!productCols.includes('category')) {
  db.exec("ALTER TABLE products ADD COLUMN category TEXT DEFAULT ''");
}

// Create product_images table for gallery
db.exec(`
  CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    imagePath TEXT NOT NULL,
    sortOrder INTEGER DEFAULT 0,
    FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
  );
`);

// Seed products
const SEED_COUNT = 12;
const count = db.prepare('SELECT COUNT(*) as cnt FROM products').get();

const products = [
  ['iPhone 17', 18999, '/images/iphone17.png', 'A19 chip. 48MP Fusion camera. Ceramic Shield front. Available in five stunning colors.', 10, 'iPhone'],
  ['iPhone 17 Pro Max', 27999, '/images/iphone17promax.png', 'A19 Pro chip. 48MP camera system. Titanium design. The most powerful iPhone ever.', 5, 'iPhone'],
  ['iPhone 16', 16499, '/images/iphone16.svg', 'A18 chip. 48MP camera. Action button. Sleek design in six vibrant colors.', 15, 'iPhone'],
  ['iPhone 16 Pro', 19999, '/images/iphone16pro.svg', 'A18 Pro chip. 48MP camera system. Titanium design. Pro-level performance.', 8, 'iPhone'],
  ['iPhone 15', 13999, '/images/iphone15.svg', 'A16 Bionic chip. 48MP camera. Dynamic Island. USB-C connectivity.', 20, 'iPhone'],
  ['iPhone 15 Pro', 17499, '/images/iphone15pro.svg', 'A17 Pro chip. Titanium frame. 48MP main camera. Lightweight and powerful.', 10, 'iPhone'],
  ['iPhone SE', 8999, '/images/iphonese.svg', 'A15 Bionic chip. 4.7-inch Retina display. Touch ID. The most affordable iPhone.', 25, 'iPhone'],
  ['AirPods Pro 2', 4999, '/images/airpodspro2.svg', 'Active Noise Cancellation. Adaptive Audio. USB-C charging case. Up to 6 hours listening.', 30, 'Accessories'],
  ['AirPods Max', 10999, '/images/airpodsmax.svg', 'High-fidelity audio. Active Noise Cancellation. 20 hours battery. Premium over-ear design.', 10, 'Accessories'],
  ['MagSafe Charger', 899, '/images/magsafe.svg', 'Perfectly aligned wireless charging for iPhone. Snaps magnetically into place.', 50, 'Accessories'],
  ['iPhone Silicone Case', 599, '/images/siliconecase.svg', 'Soft-touch silicone exterior. MagSafe compatible. Protects your iPhone in style.', 40, 'Accessories'],
  ['Apple 20W USB-C Adapter', 499, '/images/usbc-adapter.svg', 'Fast charging power adapter. USB-C connector. Compatible with any USB-C cable.', 60, 'Accessories'],
];

const hasPayments = db.prepare('SELECT COUNT(*) as cnt FROM payments').get().cnt > 0;

if (count.cnt === 0 || (count.cnt === SEED_COUNT && !hasPayments)) {
  if (count.cnt > 0) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('DELETE FROM product_images');
    db.exec('DELETE FROM payments');
    db.exec('DELETE FROM products');
    db.exec("DELETE FROM sqlite_sequence WHERE name='products'");
    db.exec('PRAGMA foreign_keys = ON');
  }

  const insert = db.prepare(
    'INSERT INTO products (name, price, image, description, stock, category) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(...item);
    }
  });

  insertMany(products);
}

module.exports = db;
