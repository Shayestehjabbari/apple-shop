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
- Fields: name (text, required), price (number, required), image (file upload, optional), description (textarea, optional)
- Submit button: "Add Product"
- On submit: calls `POST /api/products` with `multipart/form-data`, resets form, refreshes product list
- Validation: name and price are required (HTML `required` attribute + server-side check)

### Section 2: Edit Product Form
- Hidden by default; shown when user clicks "Edit" on a product row
- Pre-populated with the product's current name, price, description
- Fields: name (text, required), price (number, required), image (file upload, optional — keeps existing image if not changed), description (textarea, optional)
- Buttons: "Save Changes" (submit) and "Cancel" (hides form)
- On submit: calls `PUT /api/products/:id` with `multipart/form-data`, hides form, refreshes product list
- Shows an alert on error

### Section 3: Products List
- Each row shows: product name, price (ZMW), "Edit" button, and "Delete" button
- Edit button: opens the edit form (Section 2) with the product's current values
- Delete button: confirms with browser `confirm()` dialog, then calls `DELETE /api/products/:id`
- List refreshes after add, edit, or delete

### Section 4: Transactions Table
- Table columns: Date, Customer, Phone, Product, Amount (ZMW), Status, Deposit ID
- Sorted by most recent first
- Status shown as a colored badge:
  - `pending` — yellow
  - `completed` — green
  - `failed` — red
- Deposit ID shown in monospace font for readability
- If product was deleted, shows "Deleted product" in product column
- On load, auto-refreshes status of pending payments by calling `GET /api/payments/:depositId/status` for each

## API

### `POST /api/products` (Add Product)

**Request:** `multipart/form-data` with fields: `name`, `price`, `description`, `image` (file)

**Response:**
```json
{
  "success": true,
  "data": { "id": 3 }
}
```

**Errors:**
- `400` — name or price missing

### `PUT /api/products/:id` (Edit Product)

**Request:** `multipart/form-data` with fields: `name`, `price`, `description`, `image` (file, optional — keeps existing image if omitted)

**Response:**
```json
{ "success": true }
```

**Errors:**
- `404` — product not found
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
      "productName": "iPhone 17",
      "customerName": "John Doe",
      "customerPhone": "260971234567",
      "customerEmail": "john@example.com",
      "customerAddress": "123 Main St",
      "customerCity": "Lusaka"
    }
  ]
}
```

Query joins `payments` with `products` to include `productName`. Returns `null` for `productName` if the product was deleted.

### `GET /api/payments/:depositId/status` (Check Payment Status)

Checks deposit status from PawaPay API and updates local database.

**Response:**
```json
{ "success": true, "status": "completed", "pawapayStatus": "COMPLETED" }
```

**Errors:**
- `404` — deposit not found
- `500` — could not reach PawaPay

## Files
- `public/admin.html` — page shell with form and containers
- `public/admin.js` — fetch products, add/edit/delete products, fetch and render transactions with auto-status-refresh
- `routes/api.js` — CRUD products (POST/PUT/DELETE), GET payments, payment status check handlers

## Security Notes
- No authentication in MVP — admin page is publicly accessible
- Future: add basic auth or token-based login before production
- Delete confirmation prevents accidental deletion
