# PRD-02: PawaPay Mobile Money Payment

## Overview
Customers pay for products using mobile money (MTN, Airtel, Zamtel) via PawaPay's hosted payment page. The server creates a payment session and redirects the customer.

## User Flow
1. Customer clicks "Buy Now" on product detail page
2. Customer fills in checkout form (name, phone, email, address, city)
3. Frontend calls `POST /api/pay` with the product ID and customer details
4. Server generates a deposit ID (UUID), stores a payment record with customer data, and calls PawaPay API
5. Server returns PawaPay's `redirectUrl`
6. Frontend redirects customer to PawaPay payment page
7. Customer completes payment on PawaPay (mobile money prompt)
8. PawaPay redirects customer back to `/return.html?depositId=<uuid>`
9. Return page shows "Thank you" with a "Check Payment Status" button
10. Customer clicks button → page calls `GET /api/payments/:depositId/status`
11. Page shows result: completed (green), failed (red), or pending (orange with "Check Again" button)

## API

### `POST /api/pay`

**Request:**
```json
{
  "productId": 1,
  "customer": {
    "name": "John Doe",
    "phone": "260971234567",
    "email": "john@example.com",
    "address": "123 Main St",
    "city": "Lusaka"
  }
}
```

**Server-side steps:**
1. Validate `productId` exists and all customer fields are present
2. Generate `depositId` via `uuid.v4()`
3. Insert into `payments` table with status `pending` and customer data
4. Call PawaPay API:
   ```
   POST https://sandbox.paywith.pawapay.io/api/v1/sessions
   Headers: Authorization: Bearer {PAWAPAY_TOKEN}
   Body: {
     "depositId": "<uuid>",
     "returnUrl": "{BASE_URL}/return.html?depositId=<uuid>",
     "amount": "<product price as string>",
     "country": "ZMB",
     "reason": "Purchase: <product name> — <customer name>"
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
- `400` — missing productId or customer fields
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
| customerName | TEXT | Customer full name |
| customerPhone | TEXT | Customer phone number |
| customerEmail | TEXT | Customer email address |
| customerAddress | TEXT | Customer street address |
| customerCity | TEXT | Customer city |

## Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PAWAPAY_API` | `https://api.sandbox.pawapay.io` | PawaPay base URL |
| `PAWAPAY_TOKEN` | _(empty)_ | PawaPay bearer token |
| `BASE_URL` | `http://localhost:3000` | Return URL base |

## Return Page (`/return.html?depositId=<uuid>`)
- Reads `depositId` from URL query parameter
- Shows "Thank you" message with a "Check Payment Status" button
- On click, calls `GET /api/payments/:depositId/status` to fetch real-time status from PawaPay
- Displays result based on status:
  - **Completed** — green checkmark, success message
  - **Failed** — red X, failure message with retry suggestion
  - **Pending** — orange hourglass, "Check Again" button to re-poll
- "Back to Shop" link always visible

## Files
- `routes/api.js` — `POST /api/pay` handler, `GET /api/payments/:depositId/status` handler
- `public/checkout.html` — customer form + redirect logic
- `public/return.html` — post-payment status page with live status check
- `db/index.js` — payments table schema

## Error Handling
- If PawaPay API is down, user sees "Could not connect to payment service"
- If PawaPay returns no redirect URL, user sees "Payment failed. Please try again."
- Button re-enables on error so user can retry

## Dependencies
- `uuid` package (already installed) — generates deposit IDs
- Node.js built-in `fetch` (Node 18+) — calls PawaPay API
