# Live Show Join API – Payload, Response & Payment Flow

**Endpoint:** `POST /api/live-shows/:id/join`  
**Auth:** Bearer token required (fan or admin)

**Resource:** The `:id` in the URL is the **Live Show ID**. The backend loads the show by this ID and already has `starId` from the show document. You do **not** send `starId` in the body.

---

## 1. Request (Payload) – Clear & Standard

### URL
- **Method:** `POST`
- **Path:** `/api/live-shows/:id/join`
- **`:id`** = Live Show ID (MongoDB ObjectId of the show the fan is joining).  
  Star is determined by the show: backend uses `show.starId` for the payment receiver. **Do not send `starId` in the body.**

### Headers
```http
Content-Type: application/json
Authorization: Bearer <access_token>
```

### Body (JSON)

**When the show has an attendance fee (`attendanceFee > 0`):**

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `contact`  | string | **Yes**  | Fan’s phone number. Backend returns 400 "User phone number is required" if missing. |
| `starName` | string | **No**   | Optional. Used only in payment description/SMS (e.g. "Payment to Star Artist"). Backend uses empty string if omitted. |

**Abhi body me only `contact` chalega.** Star ka name (`starName`) **required nahi** – optional hai.

**Example – minimum (sirf contact, fee > 0):**
```json
{
  "contact": "+237690000000"
}
```

**Example – optional star name sath (payment text ma dikhane mate):**
```json
{
  "contact": "+237690000000",
  "starName": "Star Artist"
}
```

**When the show is free (`attendanceFee === 0`):**  
Send empty body `{}` or no body.  
*(If your backend requires a transaction for every join, free shows may need a separate flow; in practice, join with fee uses the above.)*

### Why there is no `starId` in the body
- The **resource** you are acting on is the **live show**, identified by `:id` in the URL.
- The backend does `LiveShow.findById(id)` and gets `show.starId` from the show document.
- Payment receiver is always `show.starId`. Sending `starId` in the body would be redundant and could be wrong or misused. Standard REST: URL identifies the resource; body only carries data needed for the action (here: payment contact and optional display name).

---

## 2. Response Examples

### 2a. Success – join with payment (coin-only)

When user has enough coins, full amount is deducted and no external payment is needed.

**Status:** `200 OK`

```json
{
  "success": true,
  "message": "Joined live show successfully",
  "data": {
    "id": "674a1b2c3d4e5f678901234",
    "sessionTitle": "Evening Live",
    "date": "2026-02-10T00:00:00.000Z",
    "time": "20:30",
    "attendanceFee": 50,
    "hostingPrice": 100,
    "maxCapacity": 100,
    "currentAttendees": 1,
    "thumbnail": "https://...",
    "showCode": "ABC12XY",
    "inviteLink": "https://app.baroni.com/live/ABC12XY",
    "starId": { "id": "...", "name": "Star Artist", "pseudo": "star1", "profilePic": "..." },
    "status": "pending",
    "paymentStatus": "pending",
    "description": "Join me live!",
    "likeCount": 0,
    "likescount": 0,
    "isFavorite": false,
    "hasJoined": true,
    "is_joined": true,
    "isLiked": false,
    "isUpcoming": true,
    "createdAt": "2026-01-27T10:00:00.000Z",
    "updatedAt": "2026-01-27T10:05:00.000Z"
  }
}
```

- No `externalPaymentMessage` → payment was coin-only and already reserved.

---

### 2b. Success – join with hybrid payment (coins + OrangeMoney)

When user does not have enough coins, part is paid by coins and rest via OrangeMoney. User is **joined** and attendance is created; external payment must be completed by user (e.g. via SMS/link).

**Status:** `200 OK`

```json
{
  "success": true,
  "message": "Joined live show successfully",
  "data": { "...same shape as 2a...", "hasJoined": true, "is_joined": true },
  "externalPaymentMessage": "Complete payment on your phone to confirm. You have 15 minutes."
}
```

- **Frontend:** Show `externalPaymentMessage` to user and remind them to complete OrangeMoney step.  
- **Backend:** When payment callback confirms external part, transaction moves to `pending` (or completed) and `LiveShowAttendance.paymentStatus` can be updated by your payment-callback flow.

---

### 2c. Already joined

User already in `attendees`; no new charge, same show payload returned.

**Status:** `200 OK`

```json
{
  "success": true,
  "message": "Already joined",
  "data": {
    "id": "674a1b2c3d4e5f678901234",
    "sessionTitle": "Evening Live",
    "hasJoined": true,
    "is_joined": true,
    "...": "..."
  }
}
```

---

### 2d. Validation / business errors

| Scenario | Status | Example body |
|----------|--------|--------------|
| Show not open for join | `400` | `{ "success": false, "message": "Show is not open for joining" }` |
| Show at capacity | `400` | `{ "success": false, "message": "Show is at capacity" }` |
| Missing phone when fee > 0 | `400` | `{ "success": false, "message": "User phone number is required" }` |
| Payment creation failed | `400` | `{ "success": false, "message": "Attendance payment failed: ..." }` |
| Invalid show id | `400` | `{ "success": false, "message": "Invalid live show ID" }` |
| Show not found | `404` | `{ "success": false, "message": "Live show not found" }` |

---

## 3. Payment flow – step by step (how payment & join happen)

- **1. Check show state**  
  - Show must exist, `status === 'pending'`, and (if `maxCapacity !== -1`) `currentAttendees < maxCapacity`.

- **2. Already joined?**  
  - If `req.user._id` is in `show.attendees` → return **“Already joined”** with full show payload (no new payment).

- **3. Amount**  
  - `amount = show.attendanceFee` (number, ≥ 0).

- **4. If amount > 0 – create payment (hybrid transaction)**  
  - **4a.** Validate `contact` (phone). If missing → `400` "User phone number is required".  
  - **4b.** `createHybridTransaction(...)`:
    - **Coin-only:** If `payer.coinBalance >= amount` → deduct full amount from fan, create one `Transaction` with `status: 'pending'`, `paymentMode: 'coin'`.  
    - **Hybrid:** If `payer.coinBalance < amount` → deduct `coinBalance` from fan, rest = `externalAmount`; call OrangeMoney (or external gateway), create `Transaction` with `status: 'initiated'`, `paymentMode: 'hybrid'`, store `externalPaymentId` and refund timer (e.g. 15 min).  
  - **4c.** If `createHybridTransaction` throws → return `400` "Attendance payment failed: ...".

- **5. Get created transaction**  
  - `Transaction.findOne({ payerId: user, receiverId: star, type: LIVE_SHOW_ATTENDANCE_PAYMENT, status: { $in: ['pending','initiated'] } }).sort({ createdAt: -1 })`.  
  - If none (e.g. fee 0 and no txn created) → return `500` "Failed to retrieve transaction". So when **fee > 0**, a transaction is always created in step 4.

- **6. Create or update attendance**  
  - Find `LiveShowAttendance` by `liveShowId` + `fanId`.  
  - If exists: set `transactionId`, `attendanceFee`, `status: 'pending'`, `paymentStatus` from transaction (`'initiated'` or `'pending'`), `joinedAt = now`, clear `cancelledAt`/`refundedAt`, save.  
  - If not: create new `LiveShowAttendance` with `liveShowId`, `fanId`, `starId`, `transactionId`, `attendanceFee`, `paymentStatus` (same as above).

- **7. Mark user as joined on show**  
  - `LiveShow.findByIdAndUpdate(id, { $addToSet: { attendees: req.user._id }, $inc: { currentAttendees: 1 } })`.

- **8. Response**  
  - Populate show, run `sanitizeLiveShow` + `setPerUserFlags` (so `hasJoined` / `is_joined` are true).  
  - If hybrid and `attendanceTxnResult.externalPaymentMessage` exists, add it to response root as `externalPaymentMessage`.

So: **payment is created (and optionally partially completed via external gateway) first; then attendance row is created/updated; then user is added to `attendees` and `currentAttendees` is incremented.**  
For coin-only, join is fully done in this request. For hybrid, join is recorded immediately; user must complete external payment within the timer; your payment callback should update transaction (and optionally attendance paymentStatus) when external payment succeeds or fails.

---

## 4. Summary table

| Step | What happens |
|------|-------------------------------|
| 1 | Validate show: pending, not full. |
| 2 | If already in `attendees` → return "Already joined". |
| 3 | If `attendanceFee > 0` → require `contact`, call `createHybridTransaction` (coin or hybrid). |
| 4 | Get latest transaction (type attendance, pending/initiated). |
| 5 | Create/update `LiveShowAttendance` with that transaction. |
| 6 | Add user to `show.attendees`, increment `currentAttendees`. |
| 7 | Return show payload with `is_joined: true`; if hybrid, add `externalPaymentMessage`. |

Use the payload and response examples above for integration; ensure `contact` is always sent when the show has an attendance fee so payment and join both complete as expected.
