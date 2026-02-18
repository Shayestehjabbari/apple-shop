# iPhone Zambia Shop

A simple web shop for browsing and purchasing iPhones in Zambia via PawaPay mobile money.

## Project Structure

```
shop/
├── server.js          # Express entry point (PORT env or 3000)
├── routes/api.js      # API route handlers + PawaPay integration
├── db/index.js        # SQLite setup, schema, seed data
├── public/
│   ├── index.html     # Product listing page
│   ├── product.html   # Product detail page with Buy Now
│   ├── admin.html     # Admin panel (products + transactions)
│   ├── return.html    # Post-payment return page
│   ├── app.js         # Frontend JS (product grid)
│   ├── admin.js       # Admin JS (CRUD products, view transactions)
│   └── style.css      # Styles
├── data/              # SQLite database directory (not committed)
└── .gitignore
```

## Tech Stack

- **Runtime:** Node.js
- **Backend:** Express
- **Database:** SQLite via better-sqlite3 (WAL mode, stored in data/shop.db)
- **Payments:** PawaPay mobile money (sandbox)
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)

## Setup

```bash
npm install
PAWAPAY_TOKEN=your_token npm start    # Runs on http://localhost:3000
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `PAWAPAY_API` | `https://api.sandbox.pawapay.io` | PawaPay API base URL |
| `PAWAPAY_TOKEN` | _(empty)_ | PawaPay API bearer token |
| `BASE_URL` | `http://localhost:3000` | Public URL for return redirects |

## API Endpoints

| Method | Path               | Description                          |
|--------|--------------------|--------------------------------------|
| GET    | `/api/products`    | List all products                    |
| GET    | `/api/products/:id`| Get single product                   |
| POST   | `/api/products`    | Add a product (admin)                |
| DELETE | `/api/products/:id`| Delete a product (admin)             |
| POST   | `/api/pay`         | Create PawaPay payment session       |
| GET    | `/api/payments`    | List all transactions (admin)        |

## Key Patterns

- SQLite database auto-creates and seeds 2 iPhone products on first run
- Prices are in ZMW (Zambian Kwacha)
- PawaPay payment flow: POST /api/pay → redirect to PawaPay → return to /return.html
- All dynamic content escaped via `esc()` helper to prevent XSS
- Admin panel has no authentication (MVP)
