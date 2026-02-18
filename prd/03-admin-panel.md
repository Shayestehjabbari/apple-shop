# PRD-03: Admin Panel

## Overview
A simple admin page for managing products and viewing payment transactions. No authentication (MVP).

## Page: `/admin.html`

### Layout
Three sections stacked vertically:
1. **Add Product** form
2. **Products** list
3. **Transactions** table

### Section 1: Add Product Form
- Fields: name (text, required), price (number, required), image URL (url, optional), description (textarea, optional)
- Submit button: "Add Product"
- On submit: calls `POST /api/products`, resets form, refreshes product list
- Validation: name and price are required (HTML `required` attribute + server-side check)

### Section 2: Products List
- Each row shows: product name, price (ZMW), and a "Delete" button
- Delete button: confirms with browser `confirm()` dialog, then calls `DELETE /api/products/:id`
- List refreshes after add or delete

### Section 3: Transactions Table
- Table columns: Date, Product, Amount (ZMW), Status, Deposit ID
- Sorted by most recent first
- Status shown as a colored badge:
  - `pending` — yellow
  - `completed` — green
  - `failed` — red
- Deposit ID shown in monospace font for readability
- If product was deleted, shows "Deleted product" in product column

## API

### `POST /api/products` (Add Product)

**Request:**
```json
{
  "name": "iPhone 17 Plus",
  "price": 22999,
  "image": "https://...",
  "description": "..."
}
```

**Response:**
```json
{
  "success": true,
  "data": { "id": 3 }
}
```

**Errors:**
- `400` — name or price missing

### `DELETE /api/products/:id` (Delete Product)

**Response:**
```json
{ "success": true }
```

**Errors:**
- `404` — product not found

### `GET /api/payments` (List Transactions)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "depositId": "550e8400-e29b-41d4-a716-446655440000",
      "productId": 1,
      "amount": 18999,
      "status": "pending",
      "createdAt": "2026-02-18T10:30:00.000Z",
      "productName": "iPhone 17"
    }
  ]
}
```

Query joins `payments` with `products` to include `productName`. Returns `null` for `productName` if the product was deleted.

## Files
- `public/admin.html` — page shell with form and containers
- `public/admin.js` — fetch products, add/delete products, fetch and render transactions
- `routes/api.js` — POST/DELETE products, GET payments handlers

## Security Notes
- No authentication in MVP — admin page is publicly accessible
- Future: add basic auth or token-based login before production
- Delete confirmation prevents accidental deletion
