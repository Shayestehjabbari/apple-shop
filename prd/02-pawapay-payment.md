# PRD-02: PawaPay Mobile Money Payment

## Overview
Customers pay for products using mobile money (MTN, Airtel, Zamtel) via PawaPay's hosted payment page. The server creates a payment session and redirects the customer.

## User Flow
1. Customer clicks "Buy Now" on product detail page
2. Button shows "Processing..." and disables
3. Frontend calls `POST /api/pay` with the product ID
4. Server generates a deposit ID (UUID), stores a payment record, and calls PawaPay API
5. Server returns PawaPay's `redirectUrl`
6. Frontend redirects customer to PawaPay payment page
7. Customer completes payment on PawaPay (mobile money prompt)
8. PawaPay redirects customer back to `/return.html`
9. Return page shows "Thank you for your purchase"

## API

### `POST /api/pay`

**Request:**
```json
{
  "productId": 1
}
```

**Server-side steps:**
1. Validate `productId` exists
2. Generate `depositId` via `uuid.v4()`
3. Insert into `payments` table with status `pending`
4. Call PawaPay API:
   ```
   POST {PAWAPAY_API}/v2/paymentpage
   Headers: Authorization: Bearer {PAWAPAY_TOKEN}
   Body: {
     "depositId": "<uuid>",
     "returnUrl": "{BASE_URL}/return.html",
     "amount": "<product price as string>",
     "country": "ZMB",
     "reason": "Purchase: <product name>"
   }
   ```
5. Return `redirectUrl` from PawaPay response

**Success response:**
```json
{
  "success": true,
  "redirectUrl": "https://pay.pawapay.io/..."
}
```

**Error responses:**
- `400` — missing productId
- `404` — product not found
- `502` — PawaPay didn't return a redirectUrl
- `500` — PawaPay unreachable

## Database

### `payments` table
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key, auto-increment |
| depositId | TEXT | UUID, unique — sent to PawaPay |
| productId | INTEGER | FK to products |
| amount | REAL | Price at time of purchase (ZMW) |
| status | TEXT | `pending` / `completed` / `failed` |
| createdAt | TEXT | ISO 8601 timestamp |

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PAWAPAY_API` | `https://api.sandbox.pawapay.io` | PawaPay base URL |
| `PAWAPAY_TOKEN` | _(empty)_ | PawaPay bearer token |
| `BASE_URL` | `http://localhost:3000` | Return URL base |

## Return Page (`/return.html`)
- Static page, no API calls
- Displays "Thank you for your purchase!" message
- Link back to shop homepage

## Files
- `routes/api.js` — `POST /api/pay` handler
- `public/product.html` — Buy Now button + redirect logic
- `public/return.html` — post-payment landing page
- `db/index.js` — payments table schema

## Error Handling
- If PawaPay API is down, user sees "Could not connect to payment service"
- If PawaPay returns no redirect URL, user sees "Payment failed. Please try again."
- Button re-enables on error so user can retry

## Dependencies
- `uuid` package (already installed) — generates deposit IDs
- Node.js built-in `fetch` (Node 18+) — calls PawaPay API
