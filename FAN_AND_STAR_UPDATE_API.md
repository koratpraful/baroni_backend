# Fan and Star Profile Update API

## Overview
The unified PATCH endpoint `/api/admin/management/user/:id` works for **both FAN and STAR** users. This document explains how the API handles each user type.

## Endpoint
**PATCH** `/api/admin/management/user/:id`

## Works for Both FAN and STAR

### ✅ Common Fields (Both FAN and STAR)

These fields can be updated for both user types:

```json
{
  "name": "John Doe",
  "pseudo": "johndoe",
  "email": "john@example.com",
  "contact": "+1234567890",
  "profilePic": "https://example.com/pic.jpg",
  "country": "USA",
  "profession": "64e9f0d0c3a1b20012345678",
  "about": "User biography...",
  "location": "New York",
  "preferredLanguage": "English",
  "availableForBookings": true,
  "hidden": false,
  "appNotification": true,
  "isVerified": true,
  "role": "star",
  "status": "active",
  "introVideo": "https://example.com/video.mp4"
}
```

### ⭐ STAR-Only Fields

These fields are **only processed for STAR** users:

1. **`feature_star`** - Featured star toggle
   - Only updated if user is a star
   - Silently ignored for fans

2. **`services`** - Services management array
   - Only processed for stars
   - Silently ignored for fans

3. **`dedicationSamples`** - Dedication samples array
   - Only processed for stars
   - Silently ignored for fans

### 📝 About Field Validation

- **For FAN**: No minimum length requirement (just max 1000 characters)
- **For STAR**: Minimum 100 characters if provided (max 1000 characters)

## Examples

### Example 1: Update FAN Profile

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/FAN_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "contact": "+1234567890",
    "profilePic": "https://example.com/pic.jpg",
    "country": "USA",
    "about": "Fan biography (no minimum length required)",
    "isVerified": true,
    "hidden": false,
    "appNotification": true
  }'
```

**Response for FAN:**
```json
{
  "success": true,
  "message": "User profile updated successfully",
  "data": {
    "user": {
      "id": "fan_id",
      "role": "fan",
      "name": "John Doe",
      "email": "john@example.com",
      "profilePic": "https://example.com/pic.jpg",
      "isVerified": true,
      "hidden": false,
      "appNotification": true
      // Note: No services or dedicationSamples in response
    }
  }
}
```

### Example 2: Update STAR Profile

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/STAR_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Emma Johnson",
    "email": "emma@example.com",
    "profilePic": "https://example.com/pic.jpg",
    "about": "Award-winning actress with over 10 years of experience in film and television. Known for versatile roles and dedication to craft.",
    "isVerified": true,
    "feature_star": true,
    "status": "active",
    "services": [
      {
        "operation": "add",
        "type": "Video Call",
        "price": 75
      }
    ],
    "dedicationSamples": [
      {
        "operation": "add",
        "type": "Birthday Wish",
        "video": "https://example.com/video.mp4"
      }
    ]
  }'
```

**Response for STAR:**
```json
{
  "success": true,
  "message": "User profile updated successfully",
  "data": {
    "user": {
      "id": "star_id",
      "role": "star",
      "name": "Emma Johnson",
      "email": "emma@example.com",
      "profilePic": "https://example.com/pic.jpg",
      "about": "Award-winning actress...",
      "isVerified": true,
      "feature_star": true,
      "status": "active",
      "services": [
        {
          "id": "service_id",
          "type": "Video Call",
          "price": 75,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "dedicationSamples": [
        {
          "id": "sample_id",
          "type": "Birthday Wish",
          "video": "https://example.com/video.mp4",
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  }
}
```

### Example 3: Change Role from FAN to STAR

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/USER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "star",
    "about": "Award-winning actress with over 10 years of experience in film and television. Known for versatile roles and dedication to craft.",
    "feature_star": true,
    "services": [
      {
        "operation": "add",
        "type": "Video Call",
        "price": 75
      }
    ]
  }'
```

## Field Behavior Summary

| Field | FAN | STAR | Notes |
|-------|-----|------|-------|
| `name` | ✅ | ✅ | Works for both |
| `email` | ✅ | ✅ | Works for both |
| `contact` | ✅ | ✅ | Works for both |
| `profilePic` | ✅ | ✅ | Works for both |
| `country` | ✅ | ✅ | Works for both |
| `profession` | ✅ | ✅ | Works for both |
| `about` | ✅ | ✅ | FAN: No min length<br>STAR: Min 100 chars |
| `location` | ✅ | ✅ | Works for both |
| `preferredLanguage` | ✅ | ✅ | Works for both |
| `availableForBookings` | ✅ | ✅ | Works for both |
| `hidden` | ✅ | ✅ | Works for both |
| `appNotification` | ✅ | ✅ | Works for both |
| `isVerified` | ✅ | ✅ | Works for both |
| `role` | ✅ | ✅ | Can change between "fan" and "star" |
| `status` | ✅ | ✅ | Works for both |
| `introVideo` | ✅ | ✅ | Works for both |
| `feature_star` | ❌ | ✅ | Only for stars (ignored for fans) |
| `services` | ❌ | ✅ | Only for stars (ignored for fans) |
| `dedicationSamples` | ❌ | ✅ | Only for stars (ignored for fans) |

## Important Notes

### 1. Silent Ignoring
- If you send `feature_star`, `services`, or `dedicationSamples` for a FAN user, they are **silently ignored** (no error)
- This allows the same request structure to work for both user types

### 2. About Field
- **FAN**: Can be any length (up to 1000 characters)
- **STAR**: Must be at least 100 characters if provided (up to 1000 characters)
- If a star's about field is less than 100 characters, API returns 400 error

### 3. Response Differences
- **FAN response**: Does NOT include `services` or `dedicationSamples` arrays
- **STAR response**: Includes `services` and `dedicationSamples` arrays
- **FAN response**: Does NOT include `feature_star` field (or it's undefined)
- **STAR response**: Includes `feature_star` field

### 4. Role Changes
- You can change a user's role from "fan" to "star" or vice versa
- When changing to "star", you can immediately add services and samples
- When changing to "fan", services and samples are ignored

## Error Handling

### About Field Too Short (STAR only)
```json
{
  "success": false,
  "message": "About field must be at least 100 characters if provided for stars"
}
```

### Service Already Exists (STAR only)
```json
{
  "success": false,
  "message": "Service type \"Video Call\" already exists for this star"
}
```

### Invalid Service/Sample ID (STAR only)
```json
{
  "success": false,
  "message": "Service not found"
}
```

## Best Practices

1. **Check User Role First**: Before sending star-specific fields, check if user is a star
2. **Handle Response Differences**: Response structure differs for fan vs star
3. **Validate About Field**: For stars, ensure about field is at least 100 characters
4. **Use Status Field**: Use `status: "active"` or `status: "blocked"` instead of individual toggles when possible

## Frontend Implementation

```javascript
// Example: Update user profile (works for both fan and star)
async function updateUserProfile(userId, updates) {
  const response = await fetch(`/api/admin/management/user/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  
  const data = await response.json();
  
  // Check if user is star to access star-specific fields
  if (data.data.user.role === 'star') {
    console.log('Services:', data.data.user.services);
    console.log('Samples:', data.data.user.dedicationSamples);
    console.log('Featured:', data.data.user.feature_star);
  }
  
  return data;
}

// Example: Update fan profile
updateUserProfile(fanId, {
  name: "John Doe",
  email: "john@example.com",
  isVerified: true
});

// Example: Update star profile
updateUserProfile(starId, {
  name: "Emma Johnson",
  email: "emma@example.com",
  isVerified: true,
  feature_star: true,
  services: [
    { operation: "add", type: "Video Call", price: 75 }
  ]
});
```

---

For complete API documentation, see:
- `UNIFIED_STAR_PROFILE_UPDATE_API.md` - Complete unified API reference
- `STAR_PROFILE_MANAGEMENT_API.md` - Star-specific APIs

















