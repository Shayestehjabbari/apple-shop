# PRD-01: Product Catalog & Shop Frontend

## Overview
Public-facing storefront where customers browse and view iPhone products available for purchase in Zambia.

## Pages

### Product Listing (`/`)
- Displays all products as cards in a responsive grid
- Each card shows: image, name, description, price in ZMW
- Clicking a card navigates to the product detail page

### Product Detail (`/product.html?id=X`)
- Shows full product info: large image, name, description, price
- Contains a "Buy Now" button that initiates payment
- Responsive layout — stacks vertically on mobile

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | Returns all products |
| GET | `/api/products/:id` | Returns single product by ID |

### Response Format
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "iPhone 17",
    "price": 18999,
    "image": "https://...",
    "description": "A19 chip..."
  }
}
```

## Database

### `products` table
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key, auto-increment |
| name | TEXT | Required |
| price | REAL | Required, in ZMW |
| image | TEXT | URL to product image |
| description | TEXT | Product description |

### Seed Data
- iPhone 17 — ZMW 18,999
- iPhone 17 Pro Max — ZMW 27,999

## Files
- `public/index.html` — listing page shell
- `public/product.html` — detail page with inline script
- `public/app.js` — fetches and renders product grid
- `public/style.css` — all styling
- `db/index.js` — schema + seed data

## XSS Prevention
All dynamic content is escaped via the `esc()` helper before rendering into the DOM.
