# Jackpot Withdrawal Request Status Update API Documentation

## Overview
This document describes the complete API system for updating jackpot withdrawal request statuses. Admins can approve, reject, or retry withdrawal requests.

---

## API Endpoints

### 1. Approve Withdrawal Request

**Endpoint:** `PATCH /api/admin/jackpot/withdrawal-requests/:id/approve`

**Description:** Approves a pending withdrawal request and processes the payment

**Authentication:** Admin required (Bearer token with admin role)

**Request Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**URL Parameters:**
- `id` (String, required): Withdrawal request ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "note": "Optional admin note (max 500 characters)"
}
```

**Request Example:**
```bash
PATCH /api/admin/jackpot/withdrawal-requests/507f1f77bcf86cd799439011/approve
Headers: Authorization: Bearer <admin_token>
Body:
{
  "note": "Approved after verification"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Withdrawal request approved and processed successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "status": "approved",
    "amount": 10000,
    "processedAt": "2025-01-15T10:30:00.000Z",
    "wallet": {
      "previousJackpot": 50000,
      "currentJackpot": 40000,
      "totalWithdrawn": 60000
    }
  }
}
```

**Response (Insufficient Balance):**
```json
{
  "success": false,
  "message": "Insufficient jackpot balance. Request has been rejected.",
  "data": {
    "availableBalance": 5000,
    "requestedAmount": 10000
  }
}
```

**Response (Invalid Status):**
```json
{
  "success": false,
  "message": "Cannot approve request with status: approved. Only pending requests can be approved."
}
```

**Status Flow:**
- **Input Status**: `pending`
- **Output Status**: `approved` (if successful) or `rejected` (if insufficient balance)
- **Wallet Action**: 
  - Amount already deducted when request was created
  - Updates `totalWithdrawn` field
  - Creates transaction record with status `completed`

---

### 2. Reject Withdrawal Request

**Endpoint:** `PATCH /api/admin/jackpot/withdrawal-requests/:id/reject`

**Description:** Rejects a pending withdrawal request and refunds the amount to jackpot

**Authentication:** Admin required (Bearer token with admin role)

**Request Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**URL Parameters:**
- `id` (String, required): Withdrawal request ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "reason": "Reason for rejection (required, 5-500 characters)",
  "note": "Optional admin note (max 500 characters)"
}
```

**Request Example:**
```bash
PATCH /api/admin/jackpot/withdrawal-requests/507f1f77bcf86cd799439011/reject
Headers: Authorization: Bearer <admin_token>
Body:
{
  "reason": "Incomplete verification documents",
  "note": "Please resubmit with complete documents"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Withdrawal request rejected successfully. Amount was not refunded to jackpot.",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "status": "rejected",
    "rejectionReason": "Payment failed - Incomplete verification documents",
    "processedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Response (Invalid Status):**
```json
{
  "success": false,
  "message": "Cannot reject request with status: approved. Only pending requests can be rejected."
}
```

**Status Flow:**
- **Input Status**: `pending`
- **Output Status**: `rejected`
- **Wallet Action**: 
  - Amount is NOT refunded to jackpot (already deducted when request was created)
  - Sets `rejectionReason` field
  - Records `rejectedBy` admin ID

**Important Note:** The amount is NOT automatically refunded when rejecting. The amount was already deducted from jackpot when the request was created with `pending` status.

---

### 3. Retry Failed Withdrawal Request

**Endpoint:** `PATCH /api/admin/jackpot/withdrawal-requests/:id/retry`

**Description:** Retries a previously rejected (failed) withdrawal request

**Authentication:** Admin required (Bearer token with admin role)

**Request Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**URL Parameters:**
- `id` (String, required): Withdrawal request ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "note": "Optional admin note (max 500 characters)"
}
```

**Request Example:**
```bash
PATCH /api/admin/jackpot/withdrawal-requests/507f1f77bcf86cd799439011/retry
Headers: Authorization: Bearer <admin_token>
Body:
{
  "note": "Retrying after balance verification"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Withdrawal request retried and processed successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "status": "approved",
    "amount": 10000,
    "processedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Response (Invalid Status):**
```json
{
  "success": false,
  "message": "Cannot retry request with status: approved. Only rejected (failed) requests can be retried."
}
```

**Response (Insufficient Balance):**
```json
{
  "success": false,
  "message": "Insufficient jackpot balance to retry withdrawal"
}
```

**Status Flow:**
- **Input Status**: `rejected`
- **Output Status**: `approved` (if successful) or remains `rejected` (if fails again)
- **Wallet Action**: 
  - Checks if sufficient balance exists
  - If successful: Updates to `approved`, clears `rejectionReason`, sets `approvedBy`
  - If fails: Keeps `rejected` status, updates `rejectionReason` with new error

---

## Status Values

### Database Status Values:
- `pending` - Request is pending approval
- `approved` - Request has been approved and processed
- `rejected` - Request has been rejected

### UI Status Mapping:
- `pending` → `pending` (UI)
- `approved` → `paid` (UI)
- `rejected` → `failed` (UI)

---

## Request Status Flow

```
┌─────────┐
│ pending │  ← Initial status when request is created
└────┬────┘
     │
     ├───[Approve]───→ ┌──────────┐
     │                 │ approved │  ← Payment processed
     │                 └──────────┘
     │
     ├───[Reject]───→ ┌──────────┐
     │                │ rejected │  ← Request rejected
     │                └────┬─────┘
     │                     │
     │                     └───[Retry]───→ ┌──────────┐
     │                                      │ approved │  ← Retry successful
     │                                      └──────────┘
     │
     └───[Auto Reject]───→ ┌──────────┐
                           │ rejected │  ← Insufficient balance
                           └──────────┘
```

---

## Usage Examples

### Example 1: Approve a Withdrawal Request

```javascript
const approveWithdrawal = async (requestId, note = '') => {
  const response = await fetch(`/api/admin/jackpot/withdrawal-requests/${requestId}/approve`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ note })
  });
  
  const data = await response.json();
  return data;
};

// Usage
const result = await approveWithdrawal('507f1f77bcf86cd799439011', 'Approved after verification');
```

### Example 2: Reject a Withdrawal Request

```javascript
const rejectWithdrawal = async (requestId, reason, note = '') => {
  const response = await fetch(`/api/admin/jackpot/withdrawal-requests/${requestId}/reject`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason, note })
  });
  
  const data = await response.json();
  return data;
};

// Usage
const result = await rejectWithdrawal(
  '507f1f77bcf86cd799439011',
  'Incomplete verification documents',
  'Please resubmit with complete documents'
);
```

### Example 3: Retry a Failed Withdrawal

```javascript
const retryWithdrawal = async (requestId, note = '') => {
  const response = await fetch(`/api/admin/jackpot/withdrawal-requests/${requestId}/retry`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ note })
  });
  
  const data = await response.json();
  return data;
};

// Usage
const result = await retryWithdrawal('507f1f77bcf86cd799439011', 'Retrying after balance verification');
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed"
}
```

**Common Causes:**
- Invalid request ID format
- Missing required fields (reason for reject)
- Invalid status transition (e.g., trying to approve an already approved request)

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Withdrawal request not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to approve withdrawal request",
  "error": "Error details"
}
```

---

## Important Notes

### 1. **Amount Deduction Behavior**
- When a withdrawal request is created with `pending` status, the amount is **immediately deducted** from the star's jackpot balance
- When approving: Amount is NOT deducted again (already deducted), only `totalWithdrawn` is updated
- When rejecting: Amount is **NOT refunded** automatically (it remains deducted)
- When retrying: If successful, amount is already deducted, just updates status

### 2. **Balance Verification**
- Before approving, the system checks if sufficient balance exists
- If insufficient balance, the request is automatically rejected with reason: "Payment failed - Insufficient jackpot balance at approval time"

### 3. **Transaction Records**
- When approving, a `StarTransaction` record is created with:
  - `type: 'withdrawal'`
  - `status: 'completed'`
  - `escrowMovement: 'release'`

### 4. **Status Transitions**
- **Approve**: Only `pending` → `approved` or `pending` → `rejected` (if insufficient balance)
- **Reject**: Only `pending` → `rejected`
- **Retry**: Only `rejected` → `approved` or `rejected` → `rejected` (if fails again)

### 5. **Admin Tracking**
- `approvedBy`: Admin ID who approved the request
- `rejectedBy`: Admin ID who rejected the request
- `processedAt`: Timestamp when request was processed

### 6. **Notes and Reasons**
- `note`: Optional admin note (max 500 characters) - can be added to any action
- `rejectionReason`: Required when rejecting (5-500 characters) - automatically prefixed with "Payment failed -"

---

## Validation Rules

### Approve Request:
- Request ID must be valid MongoDB ObjectId
- Request status must be `pending`
- Optional `note` field (max 500 characters)

### Reject Request:
- Request ID must be valid MongoDB ObjectId
- Request status must be `pending`
- `reason` field is **required** (5-500 characters)
- Optional `note` field (max 500 characters)

### Retry Request:
- Request ID must be valid MongoDB ObjectId
- Request status must be `rejected`
- Optional `note` field (max 500 characters)
- Sufficient jackpot balance must exist

---

## Testing

### Test Case 1: Approve Pending Request
```bash
curl -X PATCH "http://your-api.com/api/admin/jackpot/withdrawal-requests/REQUEST_ID/approve" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "Approved after verification"}'
```

### Test Case 2: Reject Pending Request
```bash
curl -X PATCH "http://your-api.com/api/admin/jackpot/withdrawal-requests/REQUEST_ID/reject" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Incomplete verification documents",
    "note": "Please resubmit"
  }'
```

### Test Case 3: Retry Rejected Request
```bash
curl -X PATCH "http://your-api.com/api/admin/jackpot/withdrawal-requests/REQUEST_ID/retry" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "Retrying after balance check"}'
```

### Test Case 4: Invalid Status Transition
```bash
# Try to approve an already approved request (should fail)
curl -X PATCH "http://your-api.com/api/admin/jackpot/withdrawal-requests/APPROVED_REQUEST_ID/approve" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Related APIs

### Get Withdrawal Requests
- `GET /api/admin/jackpot/withdrawal-requests` - List all withdrawal requests
- `GET /api/admin/jackpot/withdrawal-requests/:id` - Get withdrawal request details
- `GET /api/admin/jackpot/withdrawal-requests/metrics` - Get withdrawal metrics

### Get Jackpot Information
- `GET /api/admin/jackpot/metrics` - Get jackpot metrics
- `GET /api/admin/jackpot/stars` - List stars with jackpot information

---

## Support

For issues or questions, contact the development team.

















