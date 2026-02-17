const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'shop.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerName TEXT NOT NULL,
    customerEmail TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id),
    FOREIGN KEY (productId) REFERENCES products(id)
  );
`);

// Seed products if table is empty
const count = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
if (count.cnt === 0) {
  const insert = db.prepare(
    'INSERT INTO products (name, category, price, image, description) VALUES (?, ?, ?, ?, ?)'
  );

  const products = [
    ['iPhone 16 Pro', 'iPhone', 999, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone-16-pro-hero-desert-titanium?wid=400', 'A18 Pro chip. 48MP camera. Titanium design.'],
    ['iPhone 16', 'iPhone', 799, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone-16-hero-ultramarine?wid=400', 'A18 chip. 48MP camera. Bold new colors.'],
    ['MacBook Pro 14"', 'Mac', 1599, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/mbp-14-m4-pro-spacegray?wid=400', 'M4 Pro chip. 14-inch Liquid Retina XDR display.'],
    ['MacBook Air 15"', 'Mac', 1299, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/mba-15-m3-midnight?wid=400', 'M3 chip. 15.3-inch Liquid Retina display. Fanless.'],
    ['iPad Pro 13"', 'iPad', 1099, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/ipad-pro-13-hero?wid=400', 'M4 chip. Ultra Retina XDR. Thinnest Apple product ever.'],
    ['iPad Air', 'iPad', 599, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/ipad-air-m2-hero?wid=400', 'M2 chip. 11-inch and 13-inch. Landscape camera.'],
    ['Apple Watch Ultra 2', 'Watch', 799, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/watch-ultra-2-hero?wid=400', 'Most capable Apple Watch. 49mm titanium case.'],
    ['Apple Watch Series 10', 'Watch', 399, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/watch-s10-hero?wid=400', 'Thinnest ever. Bigger display. Sleep apnea detection.'],
    ['AirPods Pro 2', 'Accessories', 249, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airpods-pro-2-hero?wid=400', 'Adaptive Audio. USB-C. Hearing health features.'],
    ['AirPods Max', 'Accessories', 549, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/airpods-max-hero?wid=400', 'High-fidelity audio. Active Noise Cancellation. USB-C.'],
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(...item);
    }
  });

  insertMany(products);
}

module.exports = db;
