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
    FOREIGN KEY (productId) REFERENCES products(id)
  );
`);

// Seed products if table is empty
const count = db.prepare('SELECT COUNT(*) as cnt FROM products').get();
if (count.cnt === 0) {
  const insert = db.prepare(
    'INSERT INTO products (name, price, image, description) VALUES (?, ?, ?, ?)'
  );

  const products = [
    ['iPhone 17', 18999, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone-16-hero-ultramarine?wid=400', 'A19 chip. 48MP Fusion camera. Ceramic Shield front. Available in five stunning colors.'],
    ['iPhone 17 Pro Max', 27999, 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone-16-pro-hero-desert-titanium?wid=400', 'A19 Pro chip. 48MP camera system. Titanium design. The most powerful iPhone ever.'],
  ];

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(...item);
    }
  });

  insertMany(products);
}

module.exports = db;
