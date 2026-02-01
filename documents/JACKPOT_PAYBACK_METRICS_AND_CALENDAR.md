# Payback & Commission Manager – Jackpot: Paid / Pending / Failed & Calendar

## 1. Paid, Pending, Failed – now correct

The three cards (**Paid Today**, **Pending**, **Failed**) now use the **same data source** as the list below: **JackpotWithdrawalRequest**.

| Card         | Meaning                                      | DB status   | Date field    |
|-------------|-----------------------------------------------|------------|---------------|
| **Paid Today** | Approved and processed in the selected period | `approved` | `processedAt` |
| **Pending**    | Waiting for admin action                     | `pending`  | `createdAt`   |
| **Failed**     | Rejected in the selected period               | `rejected` | `processedAt` |

- **Metrics endpoint (cards):**  
  `GET /api/admin/jackpot/metrics`  
  or  
  `GET /api/admin/jackpot/withdrawal-requests/metrics`

- **Response shape (same for both):**
```json
{
  "success": true,
  "data": {
    "totalCurrentJackpot": 14998,
    "paidToday": { "count": 2, "amount": 200 },
    "pending": { "count": 0, "amount": 0 },
    "failed": { "count": 0, "amount": 0 }
  }
}
```

- Use `data.paidToday.count` / `data.paidToday.amount` for **Paid**,  
  `data.pending.count` / `data.pending.amount` for **Pending**,  
  `data.failed.count` / `data.failed.amount` for **Failed**.

---

## 2. Calendar (top right) – how it works

The calendar is a **date filter** for metrics and (optionally) for the list.

### Query params

| Param   | Type   | Use |
|--------|--------|-----|
| `date` | string | `"today"` → metrics for **today** (start of day to now). |
| `from` | string | ISO 8601 date (e.g. `2026-01-14` or `2026-01-14T00:00:00.000Z`) → **start** of range. |
| `to`   | string | ISO 8601 date → **end** of range. Backend treats this as **end of day** (23:59:59.999). |

### Behaviour

1. **Default / “Today”**  
   - Call metrics **without** query or with `date=today`:  
     `GET /api/admin/jackpot/metrics`  
     or  
     `GET /api/admin/jackpot/metrics?date=today`  
   - Cards show counts/amounts for **today** (Paid/Failed by `processedAt` today, Pending by `createdAt` today).

2. **Single day from calendar**  
   - User picks one day (e.g. 14 Jan 2026).  
   - Send **same** date as `from` and `to`:  
     `GET /api/admin/jackpot/metrics?from=2026-01-14&to=2026-01-14`  
   - Backend treats `to` as end of that day, so the whole day is included.

3. **Date range from calendar**  
   - User picks From + To.  
   - Example:  
     `GET /api/admin/jackpot/metrics?from=2026-01-01&to=2026-01-14`  
   - Paid/Failed: `processedAt` in `[from start of day, to end of day]`.  
   - Pending: `createdAt` in same range.

### List (table) with same date filter

- **Old list:**  
  `GET /api/admin/jackpot/withdrawals?from=...&to=...`  
  (filters by `createdAt` in range; `to` is end-of-day.)

- **New list:**  
  `GET /api/admin/jackpot/withdrawal-requests?from=...&to=...`  
  or for “today” only:  
  `GET /api/admin/jackpot/withdrawal-requests?today=true`

So: **calendar sends `date=today` or `from` + `to` to the same metrics (and list) endpoints; backend applies the range and returns correct Paid / Pending / Failed.**

---

## 3. Quick reference

| Action              | Metrics (cards) | List (table) |
|---------------------|------------------|--------------|
| Load default (today)| `GET .../metrics` or `?date=today` | `GET .../withdrawals` or `.../withdrawal-requests` |
| Calendar: one day   | `?from=YYYY-MM-DD&to=YYYY-MM-DD` (same date) | `?from=...&to=...` |
| Calendar: range     | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | `?from=...&to=...` |

Use the **same** `from`/`to` (or `date=today`) for both metrics and list so the calendar drives the whole Payback & Commission Manager Jackpot view in a consistent way.
