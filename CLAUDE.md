# Apple Shop

A simple web shop for browsing and ordering Apple products.

## Project Structure

```
shop/
├── server.js          # Express entry point (PORT env or 3000)
├── routes/api.js      # API route handlers
├── db/index.js        # SQLite setup, schema, seed data
├── public/
│   ├── index.html     # Single-page frontend
│   ├── app.js         # Frontend JS (product grid, cart, checkout)
│   └── style.css      # Apple-inspired styles
├── data/              # SQLite database directory (not committed)
└── .gitignore
```

## Tech Stack

- **Runtime:** Node.js
- **Backend:** Express
- **Database:** SQLite via better-sqlite3 (WAL mode, stored in data/shop.db)
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)

## Setup

```bash
npm install
npm start    # Runs on http://localhost:3000
```

## API Endpoints

| Method | Path               | Description                          |
|--------|--------------------|--------------------------------------|
| GET    | `/api/products`    | List products (?category= filter)    |
| GET    | `/api/products/:id`| Get single product                   |
| GET    | `/api/categories`  | List distinct categories             |
| POST   | `/api/orders`      | Place an order                       |
| GET    | `/api/orders`      | List all orders                      |
| GET    | `/api/orders/:id`  | Get order with items                 |

## Key Patterns

- SQLite database auto-creates and seeds 10 Apple products on first run
- Cart is managed client-side in memory (no server-side sessions)
- All dynamic content escaped via `esc()` helper to prevent XSS
- Orders are stored with line items in a transaction for consistency
