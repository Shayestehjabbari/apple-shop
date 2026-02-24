# Project Guide

## Tech Stack

| Name | What it is | Role |
|------|-----------|------|
| **JavaScript** | Programming language | Used everywhere (server + browser) |
| **HTML / CSS** | Markup / Styling | Structure and appearance of web pages |
| **Node.js** | Runtime | Runs JavaScript on the server |
| **Express** | Framework | Handles web requests and routing |
| **SQLite** (`better-sqlite3`) | Database | Stores products, payments, and images in a single file |
| **PawaPay API** | Payment service | Processes mobile money payments |
| **multer** | Library | Handles file uploads (product images) |
| **uuid** | Library | Generates unique IDs for payments |

## Project Structure

```
shop/
├── server.js              # Entry point — starts the server
├── package.json           # Lists dependencies (libraries this project needs)
│
├── db/
│   └── index.js           # Database setup: creates tables, migrations, seed data
│
├── routes/
│   └── api.js             # All API endpoints (the backend logic)
│
├── data/
│   └── shop.db            # The SQLite database file
│
├── public/                # Frontend — what the user sees in the browser
│   ├── index.html         # Home page (product listing)
│   ├── product.html       # Single product detail page
│   ├── checkout.html      # Checkout / payment page
│   ├── return.html        # Page shown after payment
│   ├── orders.html        # Order history page
│   ├── transaction.html   # Transaction detail page
│   ├── admin.html         # Admin panel
│   ├── app.js             # JavaScript for storefront pages
│   ├── admin.js           # JavaScript for admin panel
│   ├── style.css          # All styling
│   └── images/            # Product images
│
└── .env                   # Secret settings (API keys) — never shared
```

## How a Request Flows

```
Browser (HTML/CSS/JS)  ←→  Express Server (server.js)  ←→  SQLite Database (db/index.js)
                                    ↕
                              PawaPay API (payments)
```

1. User opens a page in the browser
2. Browser sends a request to the Express server
3. Server reads/writes data from the SQLite database
4. For payments, the server talks to PawaPay
5. Server sends a JSON response back to the browser

## Key Files Explained

### `server.js` — The Entry Point

Starts the server and connects everything. Does 4 things:

1. Loads secret settings from `.env`
2. Imports Express and the API routes
3. Configures middleware (JSON parsing, static files, API routing)
4. Starts listening on port 3000

### `routes/api.js` — The Backend Logic

All API endpoints live here. Organized into two groups:

**Public routes** (anyone can use):

| Method | Path | What it does |
|--------|------|-------------|
| GET | `/api/products` | List all products |
| GET | `/api/products/:id` | Get one product with gallery images |
| POST | `/api/pay` | Create a payment (validates input, decrements stock, calls PawaPay) |
| POST | `/api/callback/deposit` | Webhook — PawaPay notifies us when payment status changes |
| GET | `/api/payments/:depositId/status` | Actively check payment status from PawaPay |
| GET | `/api/orders?phone=...` | Look up orders by phone number |

**Admin routes** (for managing the shop):

| Method | Path | What it does |
|--------|------|-------------|
| POST | `/api/products` | Add a new product (with image upload) |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |
| GET | `/api/payments` | List all payments |
| GET | `/api/payments/:depositId` | Get one payment with product info |
| GET | `/api/admin/stats` | Dashboard statistics (revenue, stock, order counts) |
| DELETE | `/api/product-images/:id` | Delete a gallery image |

### `db/index.js` — The Database

Sets up the SQLite database. Does 4 things in order:

1. **Creates** the database file (`data/shop.db`)
2. **Creates 3 tables** if they don't exist:
   - `products` — id, name, price, image, description, stock, category
   - `payments` — id, depositId, productId, amount, status, customer info
   - `product_images` — id, productId, imagePath, sortOrder
3. **Migrations** — safely adds new columns to existing tables without losing data
4. **Seeds** — inserts 12 starter products if the database is empty

## Key Concepts

- **Middleware** — Code that runs between receiving a request and sending a response (e.g., `express.json()` parses incoming JSON)
- **Router** — Groups related routes together (`express.Router()`)
- **Migration** — Safely updating the database structure without losing data
- **Seed data** — Starter data inserted when the database is first created
- **Webhook** — When an external service (PawaPay) calls your server to notify you of an event
- **Transaction** — A batch of database operations that either all succeed or all fail
- **Foreign Key** — A link between tables (e.g., `payments.productId` references `products.id`)
- **`module.exports`** — Makes code available to other files via `require()`
