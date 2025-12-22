# Appointments API Documentation

## Overview
This document describes the complete API system for managing appointments and dedications with search and date filtering capabilities.

---

## 1. User Appointments API

### Get User Appointments
**Endpoint:** `GET /api/appointments`

**Description:** Retrieves appointments for the authenticated user (fan or star) with optional search and date filtering

**Authentication:** Required (Bearer token)

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `page` | Number | No | Page number (default: 1) | `1` |
| `limit` | Number | No | Items per page (default: 10) | `10` |
| `search` | String | No | Search by star name, fan name, or Baroni ID | `star19` |
| `status` | String | No | Filter by status: `pending`, `approved`, `rejected`, `cancelled`, `completed` | `pending` |
| `date` | String | No | Exact date filter (YYYY-MM-DD format) | `2025-11-20` |
| `startDate` | String | No | Start date for range filter (YYYY-MM-DD or ISO 8601) | `2025-11-14` or `2025-11-14T06:54:19.171Z` |
| `endDate` | String | No | End date for range filter (YYYY-MM-DD or ISO 8601) | `2025-11-18` or `2025-11-18T06:54:19.171Z` |

**Request Example:**
```bash
GET /api/appointments?page=1&limit=20&search=star19&startDate=2025-11-14&endDate=2025-11-18&status=pending
Headers: Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "appointment_id",
        "date": "2025-11-20",
        "time": "14:30",
        "status": "pending",
        "price": 5000,
        "starId": {
          "id": "star_id",
          "name": "Star19",
          "baroniId": "12345",
          "profilePic": "https://..."
        },
        "fanId": {
          "id": "fan_id",
          "name": "Fan Name",
          "baroniId": "67890"
        },
        "availabilityId": {
          "id": "availability_id",
          "date": "2025-11-20",
          "timeSlots": [...]
        },
        "timeSlot": {
          "id": "slot_id",
          "slot": "14:30 - 14:50",
          "status": "booked"
        },
        "startAt": "2025-11-20T14:30:00.000Z",
        "timeToNowMs": 1234567890,
        "conversationId": "conversation_id"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 100,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 20
    }
  }
}
```

**Search Functionality:**
- Searches in star name, fan name, Baroni ID, and pseudo
- Case-insensitive search
- Returns appointments where either star or fan matches the search term

**Date Filtering:**
- Supports both YYYY-MM-DD format (`2025-11-14`) and ISO 8601 format (`2025-11-14T06:54:19.171Z`)
- `date`: Exact date match
- `startDate` and `endDate`: Date range filter
- If both `startDate` and `endDate` are the same, it acts as an exact date match

**User Role Behavior:**
- **Fans**: See only their own appointments
- **Stars**: See only their own appointments (excluding those with `paymentStatus: 'initiated'`)
- **Admins**: See all appointments (when using admin endpoints)

---

## 2. Admin Dedications API

### Get Dedication Appointments
**Endpoint:** `GET /api/admin/appointments/dedications`

**Description:** Retrieves all dedication appointments with optional search and filtering (Admin only)

**Authentication:** Required (Admin Bearer token)

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `page` | Number | No | Page number (default: 1) | `1` |
| `limit` | Number | No | Items per page (default: 20) | `20` |
| `search` | String | No | Search by star name, fan name, Baroni ID, occasion, eventName, or description | `wedding` |
| `status` | String | No | Filter by status: `all`, `pending`, `approved`, `cancelled`, `rejected`, `completed` (default: `all`) | `pending` |
| `startDate` | String | No | Start date for range filter (ISO 8601 format) | `2025-11-14T00:00:00.000Z` |
| `endDate` | String | No | End date for range filter (ISO 8601 format) | `2025-11-18T23:59:59.999Z` |

**Request Example:**
```bash
GET /api/admin/appointments/dedications?page=2&limit=20&search=wedding&status=all&startDate=2025-11-14T00:00:00.000Z&endDate=2025-11-18T23:59:59.999Z
Headers: Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dedications": [
      {
        "id": "dedication_id",
        "dedicationId": "dedication_id",
        "dedicationType": "Wedding",
        "type": "Wedding",
        "message": "Happy wedding wishes",
        "star": {
          "id": "star_id",
          "name": "Star Name",
          "baroniId": "12345",
          "profilePic": "https://...",
          "professionId": "profession_id",
          "professionName": "Musician"
        },
        "user": {
          "id": "fan_id",
          "name": "Fan Name",
          "baroniId": "67890",
          "profilePic": "https://..."
        },
        "scheduledDateTime": "2025-11-20T14:30:00.000Z",
        "status": "pending",
        "price": 10000,
        "videoUrl": "https://..."
      }
    ],
    "pagination": {
      "currentPage": 2,
      "totalPages": 5,
      "totalCount": 100,
      "hasNextPage": true,
      "hasPrevPage": true,
      "limit": 20
    },
    "filters": {
      "status": "all",
      "startDate": "2025-11-14T00:00:00.000Z",
      "endDate": "2025-11-18T23:59:59.999Z",
      "search": "wedding"
    }
  }
}
```

**Search Functionality:**
- Searches in multiple fields:
  - **User fields**: Star name, fan name, Baroni ID, pseudo
  - **Dedication fields**: `occasion`, `eventName`, `description`
- Case-insensitive search
- Returns dedications where any of these fields match the search term

**Date Filtering:**
- Filters by `createdAt` field
- Uses ISO 8601 format
- `startDate`: Appointments created on or after this date
- `endDate`: Appointments created on or before this date

---

## Usage Examples

### Example 1: Search Appointments by Star Name
```bash
GET /api/appointments?page=1&limit=10&search=star19
```

**Response:** Returns all appointments where the star name, Baroni ID, or pseudo contains "star19"

---

### Example 2: Filter Appointments by Date Range
```bash
GET /api/appointments?page=1&limit=10&startDate=2025-11-14&endDate=2025-11-18
```

**Response:** Returns appointments scheduled between November 14 and November 18, 2025

---

### Example 3: Search Dedications by Occasion
```bash
GET /api/admin/appointments/dedications?page=1&limit=20&search=wedding
```

**Response:** Returns all dedications where:
- Star name, fan name, or Baroni ID contains "wedding", OR
- Occasion, eventName, or description contains "wedding"

---

### Example 4: Combined Filters
```bash
GET /api/appointments?page=1&limit=20&search=star19&startDate=2025-11-14T06:54:19.171Z&endDate=2025-11-18T06:54:19.171Z&status=pending
```

**Response:** Returns pending appointments for "star19" between the specified dates

---

### Example 5: Admin Dedications with All Filters
```bash
GET /api/admin/appointments/dedications?page=2&limit=20&search=wedding&status=approved&startDate=2025-11-14T00:00:00.000Z&endDate=2025-11-18T23:59:59.999Z
```

**Response:** Returns approved dedications matching "wedding" created in the specified date range

---

## Frontend Integration Examples

### React/JavaScript - Get Appointments with Search
```javascript
const getAppointments = async (page = 1, limit = 10, search = '', startDate = '', endDate = '', status = '') => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  });
  
  if (search) params.append('search', search);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (status) params.append('status', status);
  
  const response = await fetch(`/api/appointments?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data;
};

// Usage
const appointments = await getAppointments(1, 20, 'star19', '2025-11-14', '2025-11-18', 'pending');
```

### React/JavaScript - Get Dedications with Search
```javascript
const getDedications = async (page = 1, limit = 20, search = '', status = 'all', startDate = '', endDate = '') => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    status: status
  });
  
  if (search) params.append('search', search);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const response = await fetch(`/api/admin/appointments/dedications?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  
  const data = await response.json();
  return data;
};

// Usage
const dedications = await getDedications(2, 20, 'wedding', 'all', '2025-11-14T00:00:00.000Z', '2025-11-18T23:59:59.999Z');
```

---

## Date Format Support

Both APIs support multiple date formats:

1. **YYYY-MM-DD** format: `2025-11-14`
2. **ISO 8601** format: `2025-11-14T06:54:19.171Z`

The API automatically converts ISO 8601 dates to YYYY-MM-DD format for filtering.

---

## Status Values

### Appointments API Status:
- `pending` - Appointment is pending approval
- `approved` - Appointment has been approved
- `rejected` - Appointment has been rejected
- `cancelled` - Appointment has been cancelled
- `completed` - Appointment has been completed

### Dedications API Status:
- `all` - All statuses (default)
- `pending` - Dedication is pending
- `approved` - Dedication has been approved
- `cancelled` - Dedication has been cancelled
- `rejected` - Dedication has been rejected
- `completed` - Dedication has been completed

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed"
}
```

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

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Important Notes

1. **Authentication**: Both APIs require authentication. Dedications API requires admin role.

2. **Search Behavior**:
   - Appointments API: Searches in user fields (star/fan name, Baroni ID, pseudo)
   - Dedications API: Searches in user fields AND dedication-specific fields (occasion, eventName, description)

3. **Date Filtering**:
   - Appointments API: Filters by appointment `date` field
   - Dedications API: Filters by `createdAt` field

4. **Pagination**: Both APIs support pagination with `page` and `limit` parameters

5. **Default Values**:
   - Appointments: `page=1`, `limit=10`
   - Dedications: `page=1`, `limit=20`, `status=all`

6. **Case Sensitivity**: All searches are case-insensitive

---

## Testing

### Test Case 1: Search Appointments
```bash
curl -X GET "http://your-api.com/api/appointments?page=1&limit=20&search=star19" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Case 2: Date Range Filter
```bash
curl -X GET "http://your-api.com/api/appointments?page=1&limit=10&startDate=2025-11-14&endDate=2025-11-18" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Case 3: Search Dedications
```bash
curl -X GET "http://your-api.com/api/admin/appointments/dedications?page=2&limit=20&search=wedding" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Test Case 4: Combined Filters
```bash
curl -X GET "http://your-api.com/api/appointments?page=1&limit=20&search=star19&startDate=2025-11-14T06:54:19.171Z&endDate=2025-11-18T06:54:19.171Z&status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Support

For issues or questions, contact the development team.

