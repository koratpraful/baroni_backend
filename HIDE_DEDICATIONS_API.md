# Hide Dedications Feature API Documentation

## Overview
This API allows admins to control the visibility of dedication prices in the application. When enabled, dedication prices will be hidden from users.

## API Endpoints

### 1. Get Hide Dedications Configuration

**Endpoint:** `GET /api/config/`

**Description:** Retrieves the current hide dedications configuration

**Authentication:** Public (no auth required)

**Response:**
```json
{
  "success": true,
  "message": "Global configuration retrieved successfully",
  "data": {
    "config": {
      "id": "config_id",
      "hideElementsPrice": {
        "hideDedications": false
      },
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

**Response Fields:**
- `hideElementsPrice.hideDedications` (Boolean): 
  - `false` - Dedication prices are visible (default)
  - `true` - Dedication prices are hidden

---

### 2. Update Hide Dedications Configuration

**Endpoint:** `PUT /api/config/` or `POST /api/config/`

**Description:** Updates the hide dedications configuration

**Authentication:** Admin required (Bearer token with admin role)

**Request Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "hideElementsPrice": {
    "hideDedications": true
  }
}
```

**Full Example Request:**
```json
{
  "hideElementsPrice": {
    "hideDedications": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Global configuration updated successfully",
  "data": {
    "config": {
      "id": "config_id",
      "hideElementsPrice": {
        "hideDedications": true
      },
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Hide dedications must be a boolean"
}
```

---

## Usage Examples

### Example 1: Hide Dedication Prices

**Request:**
```bash
curl -X PUT "https://your-api.com/api/config/" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hideElementsPrice": {
      "hideDedications": true
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Global configuration updated successfully",
  "data": {
    "config": {
      "hideElementsPrice": {
        "hideDedications": true
      }
    }
  }
}
```

### Example 2: Show Dedication Prices

**Request:**
```bash
curl -X PUT "https://your-api.com/api/config/" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hideElementsPrice": {
      "hideDedications": false
    }
  }'
```

### Example 3: Get Current Configuration

**Request:**
```bash
curl -X GET "https://your-api.com/api/config/"
```

**Response:**
```json
{
  "success": true,
  "message": "Global configuration retrieved successfully",
  "data": {
    "config": {
      "hideElementsPrice": {
        "hideDedications": false
      }
    }
  }
}
```

---

## Frontend Integration

### React/JavaScript Example

```javascript
// Get current configuration
const getHideDedicationsConfig = async () => {
  const response = await fetch('/api/config/');
  const data = await response.json();
  return data.data.config.hideElementsPrice.hideDedications;
};

// Update configuration
const updateHideDedications = async (hideDedications) => {
  const response = await fetch('/api/config/', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hideElementsPrice: {
        hideDedications: hideDedications
      }
    })
  });
  const data = await response.json();
  return data;
};

// Usage
const hideDedications = await getHideDedicationsConfig();
if (hideDedications) {
  // Hide dedication prices in UI
  document.querySelectorAll('.dedication-price').forEach(el => {
    el.style.display = 'none';
  });
}
```

---

## Important Notes

1. **Admin Only**: Update endpoint requires admin authentication
2. **Boolean Value**: `hideDedications` must be a boolean (true/false)
3. **Default Value**: Default is `false` (prices are visible)
4. **Dedication Only**: This feature only affects dedication prices, not video calls or live shows
5. **Partial Updates**: You can update only `hideElementsPrice` without affecting other configuration fields

---

## Validation Rules

- `hideElementsPrice.hideDedications` must be a boolean value
- Cannot be null or undefined
- Default value is `false` if not provided

---

## Error Codes

- `400 Bad Request`: Invalid request body or validation error
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin role
- `500 Internal Server Error`: Server error during update

---

## Testing

### Test Cases

1. **Get Configuration (Default)**
   - Should return `hideDedications: false` by default

2. **Update to Hide**
   - Set `hideDedications: true`
   - Verify response shows `true`

3. **Update to Show**
   - Set `hideDedications: false`
   - Verify response shows `false`

4. **Invalid Input**
   - Send string instead of boolean
   - Should return validation error

5. **Unauthorized Access**
   - Try to update without admin token
   - Should return 401/403 error

---

## Support

For issues or questions, contact the development team.













