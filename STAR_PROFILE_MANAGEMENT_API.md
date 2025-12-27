# Star Profile Management API Documentation

This document provides comprehensive API documentation for admin star profile management endpoints. These APIs support both the **Star Profile View Screen** and **Star Profile Edit Screen**.

## Base URL
```
/api/admin/management
```

All endpoints require admin authentication and role verification.

## Authentication
All endpoints require:
- Valid JWT token in `Authorization` header: `Bearer <token>`
- Admin role verification

---

## 1. Get Star Profile (View Screen)

**GET** `/stars/:starId`

Get comprehensive star profile information including statistics, services, dedication samples, revenue, and activity metrics.

### Path Parameters
- `starId` (required): MongoDB ObjectId of the star

### Query Parameters
- `period` (optional): Time period for statistics. Options: `7`, `15`, `30`, `60`, `90` (default: `30`)

### Response Structure
```json
{
  "success": true,
  "message": "Star profile retrieved successfully",
  "data": {
    "star": {
      "id": "star_id",
      "baroniId": "BR12345",
      "name": "Emma Johnson",
      "pseudo": "emma_j",
      "email": "baronistar@gmail.com",
      "contact": "+45 4325236646",
      "profilePic": "https://example.com/profile.jpg",
      "role": "star",
      "country": "United States",
      "countryFlag": "🇺🇸",
      "preferredLanguage": "English",
      "profession": {
        "id": "profession_id",
        "name": "Hollywood Actress"
      },
      "about": "Award-winning actress and voice artist with over 10 years of experience...",
      "location": "United States",
      "availableForBookings": true,
      "hidden": false,
      "appNotification": true,
      "coinBalance": 500,
      "deviceType": "ios",
      "isAddedInFeatureStar": true,
      "isOnlineStar": false,
      "isVerified": true,
      "introVideo": "https://example.com/intro.mp4",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z"
    },
    "rating": {
      "average": 4.9,
      "totalReviews": 90
    },
    "services": [
      {
        "id": "service_id",
        "type": "Video Call",
        "price": 75,
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "service_id_2",
        "type": "Dedication",
        "price": 150,
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "service_id_3",
        "type": "Live Show",
        "price": 250,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "dedicationSamples": [
      {
        "id": "sample_id",
        "type": "Birthday Wish",
        "video": "https://example.com/video.mp4",
        "description": "Sample description",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "overview": {
      "period": "30 days",
      "videoCalls": 184,
      "dedications": 184,
      "liveShows": 184,
      "engagedUsers": 184
    },
    "cancelled": {
      "period": "30 days",
      "videoCalls": 10,
      "dedications": 5,
      "liveShows": 2,
      "rejectedByStar": 3
    },
    "revenue": {
      "total": 14230,
      "escrow": 497
    }
  }
}
```

### Example Request
```bash
curl -X GET "https://api.example.com/api/admin/management/stars/507f1f77bcf86cd799439011?period=30" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 2. Update Star Profile (Edit Screen)

**PUT** `/stars/:starId`

Update star profile information. Supports partial updates - only include fields you want to change.

### Path Parameters
- `starId` (required): MongoDB ObjectId of the star

### Request Body
All fields are optional. Only include fields you want to update.

```json
{
  "name": "Sophia Willson",
  "pseudo": "sophia_w",
  "email": "sophie.turner@example.com",
  "contact": "+44 223583478567",
  "profilePic": "https://example.com/new-profile.jpg",
  "country": "USA",
  "profession": "profession_id_here",
  "category": "profession_id_here",
  "about": "Tell fans more about your background, talents, or style... (minimum 100 characters)",
  "location": "United States",
  "preferredLanguage": "English",
  "role": "star",
  "isVerified": true,
  "status": "active",
  "availableForBookings": true,
  "hidden": false,
  "appNotification": true,
  "feature_star": true,
  "introVideo": "https://example.com/intro-video.mp4"
}
```

### Field Descriptions

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `name` | string | Star's full name | 1-100 characters |
| `pseudo` | string | Star's username/pseudo | 1-50 characters |
| `email` | string | Star's email address | Valid email format |
| `contact` | string | Phone number with country code | Max 20 characters |
| `profilePic` | string | Profile picture URL | Valid URL or empty string to remove |
| `country` | string | Country name | Max 50 characters |
| `profession` | string | Profession/Category ID | Valid MongoDB ObjectId |
| `category` | string | Same as profession (alternative field name) | Valid MongoDB ObjectId |
| `about` | string | Biography/About section | Minimum 100 characters if provided |
| `location` | string | Location/Address | Max 100 characters |
| `preferredLanguage` | string | Preferred language | Max 50 characters |
| `role` | string | User role | Must be "star" or "fan" |
| `isVerified` | boolean | Verified status | true/false |
| `status` | string | Account status | "active", "blocked", or "inactive" |
| `availableForBookings` | boolean | Available for bookings toggle | true/false |
| `hidden` | boolean | Hidden mode toggle | true/false |
| `appNotification` | boolean | App notifications toggle | true/false |
| `feature_star` | boolean | Add in feature stars toggle | true/false |
| `introVideo` | string | Intro video URL | Valid URL or empty string to remove |

### Status Field Mapping
- `"active"` → Sets `availableForBookings: true`, `hidden: false`
- `"blocked"` or `"inactive"` → Sets `availableForBookings: false`, `hidden: true`

### Response
```json
{
  "success": true,
  "message": "Star profile updated successfully",
  "data": {
    "star": {
      "id": "star_id",
      "baroniId": "BR12345",
      "name": "Sophia Willson",
      "pseudo": "sophia_w",
      "email": "sophie.turner@example.com",
      "contact": "+44 223583478567",
      "profilePic": "https://example.com/new-profile.jpg",
      "country": "USA",
      "countryFlag": "🇺🇸",
      "profession": {
        "id": "profession_id",
        "name": "Actor"
      },
      "about": "Updated biography...",
      "location": "United States",
      "preferredLanguage": "English",
      "availableForBookings": true,
      "hidden": false,
      "appNotification": true,
      "role": "star",
      "isVerified": true,
      "feature_star": true,
      "introVideo": "https://example.com/intro-video.mp4",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Example Request
```bash
curl -X PUT "https://api.example.com/api/admin/management/stars/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sophia Willson",
    "email": "sophie.turner@example.com",
    "isVerified": true,
    "feature_star": true,
    "status": "active"
  }'
```

---

## 3. Star Services Management

### 3.1 Get Star Services

**GET** `/stars/:starId/services`

Get all services for a specific star.

#### Response
```json
{
  "success": true,
  "message": "Star services retrieved successfully",
  "data": {
    "services": [
      {
        "id": "service_id",
        "type": "Video Call",
        "price": 75,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### 3.2 Add Star Service

**POST** `/stars/:starId/services`

Add a new service for a star.

#### Request Body
```json
{
  "type": "Video Call",
  "price": 75
}
```

#### Response
```json
{
  "success": true,
  "message": "Service added successfully",
  "data": {
    "service": {
      "id": "service_id",
      "type": "Video Call",
      "price": 75,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 3.3 Update Star Service

**PUT** `/stars/:starId/services/:serviceId`

Update an existing service.

#### Request Body
```json
{
  "type": "Video Call",
  "price": 100
}
```

Both fields are optional - only include fields you want to update.

### 3.4 Delete Star Service

**DELETE** `/stars/:starId/services/:serviceId`

Delete a service.

#### Response
```json
{
  "success": true,
  "message": "Service deleted successfully"
}
```

---

## 4. Star Dedication Samples Management

### 4.1 Get Star Dedication Samples

**GET** `/stars/:starId/dedication-samples`

Get all dedication samples for a specific star.

#### Response
```json
{
  "success": true,
  "message": "Star dedication samples retrieved successfully",
  "data": {
    "samples": [
      {
        "id": "sample_id",
        "type": "Birthday Wish",
        "video": "https://example.com/video.mp4",
        "description": "Sample description",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### 4.2 Add Star Dedication Sample

**POST** `/stars/:starId/dedication-samples`

Add a new dedication sample.

#### Request Body
```json
{
  "type": "Birthday Wish",
  "video": "https://example.com/video.mp4",
  "description": "Sample description"
}
```

#### Response
```json
{
  "success": true,
  "message": "Dedication sample added successfully",
  "data": {
    "sample": {
      "id": "sample_id",
      "type": "Birthday Wish",
      "video": "https://example.com/video.mp4",
      "description": "Sample description",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 4.3 Update Star Dedication Sample

**PUT** `/stars/:starId/dedication-samples/:sampleId`

Update an existing dedication sample.

#### Request Body
```json
{
  "type": "Anniversary Wish",
  "video": "https://example.com/new-video.mp4",
  "description": "Updated description"
}
```

All fields are optional.

### 4.4 Delete Star Dedication Sample

**DELETE** `/stars/:starId/dedication-samples/:sampleId`

Delete a dedication sample.

#### Response
```json
{
  "success": true,
  "message": "Dedication sample deleted successfully"
}
```

---

## 5. Star Status Management

### 5.1 Update Star Status (Block/Unblock)

**PATCH** `/stars/:starId/status`

Block or unblock a star.

#### Request Body
```json
{
  "action": "block",
  "reason": "Violation of terms"
}
```

- `action`: Must be `"block"` or `"unblock"`
- `reason`: Optional string (max 500 characters)

#### Response
```json
{
  "success": true,
  "message": "Star blocked successfully",
  "data": {
    "star": {
      "id": "star_id",
      "name": "Emma Johnson",
      "pseudo": "emma_j",
      "status": "blocked",
      "availableForBookings": false,
      "hidden": true,
      "reason": "Violation of terms"
    }
  }
}
```

### 5.2 Reset Star Password

**POST** `/stars/:starId/reset-password`

Reset a star's password.

#### Request Body
```json
{
  "newPassword": "newSecurePassword123"
}
```

- `newPassword`: Must be at least 6 characters

#### Response
```json
{
  "success": true,
  "message": "Star password reset successfully",
  "data": {
    "star": {
      "id": "star_id",
      "name": "Emma Johnson",
      "pseudo": "emma_j"
    }
  }
}
```

**Note:** This will invalidate all existing sessions for the star.

### 5.3 Delete Star

**DELETE** `/stars/:starId`

Soft delete a star (marks as deleted but doesn't remove from database).

#### Request Body
```json
{
  "reason": "Account closure request"
}
```

- `reason`: Optional string (max 500 characters)

#### Response
```json
{
  "success": true,
  "message": "Star deleted successfully",
  "data": {
    "star": {
      "id": "star_id",
      "name": "Emma Johnson",
      "pseudo": "emma_j",
      "isDeleted": true,
      "deletedAt": "2024-01-01T00:00:00.000Z",
      "reason": "Account closure request"
    }
  }
}
```

---

## 6. Star Verification & Features

### 6.1 Update Star Verified Status

**PATCH** `/stars/:starId/verified`

Update the verified status of a star.

#### Request Body
```json
{
  "isVerified": true
}
```

#### Response
```json
{
  "success": true,
  "message": "Star verified successfully",
  "data": {
    "star": {
      "id": "star_id",
      "name": "Emma Johnson",
      "pseudo": "emma_j",
      "isVerified": true
    }
  }
}
```

### 6.2 Update Star Intro Video

**PATCH** `/stars/:starId/intro-video`

Update or remove the intro video.

#### Request Body
```json
{
  "introVideo": "https://example.com/intro-video.mp4"
}
```

To remove the intro video, send an empty string:
```json
{
  "introVideo": ""
}
```

#### Response
```json
{
  "success": true,
  "message": "Star intro video updated successfully",
  "data": {
    "star": {
      "id": "star_id",
      "name": "Emma Johnson",
      "pseudo": "emma_j",
      "introVideo": "https://example.com/intro-video.mp4"
    }
  }
}
```

### 6.3 Toggle Featured Star Status

**PATCH** `/stars/:starId/feature`

Toggle featured star status (Add In Feature Stars).

#### Request Body
```json
{
  "feature_star": true
}
```

#### Response
```json
{
  "success": true,
  "message": "Star featured successfully",
  "data": {
    "star": {
      "id": "star_id",
      "name": "Emma Johnson",
      "pseudo": "emma_j",
      "baroniId": "BR12345",
      "feature_star": true
    }
  }
}
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "message": "Error message description"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created (for POST requests)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (not an admin)
- `404` - Not Found (star/service/sample not found)
- `409` - Conflict (duplicate service type)
- `500` - Internal Server Error

### Example Error Response
```json
{
  "success": false,
  "message": "Invalid star ID"
}
```

---

## Implementation Notes

### Screen Mapping

#### View Profile Screen Features:
- ✅ Profile information (name, email, contact, location, language)
- ✅ Verification status and role
- ✅ Status buttons (Activated, Block, Reset Password)
- ✅ Toggles (Available for Bookings, Hidden Mode, Add In Feature Stars, Online Star)
- ✅ Biography/About section
- ✅ Overview metrics (Video Calls, Dedications, Live Shows, Engaged Users)
- ✅ Cancelled metrics
- ✅ Revenue Insights
- ✅ Services list
- ✅ Sample Dedications

#### Edit Profile Screen Features:
- ✅ Profile picture upload/edit
- ✅ Role toggle (Star/Fan)
- ✅ Verified toggle
- ✅ Personal Info fields (all editable)
- ✅ About You (with 100 character minimum validation)
- ✅ Status dropdown
- ✅ Dedication services management
- ✅ Other Services management
- ✅ Intro Video management
- ✅ Sample Dedications management
- ✅ Delete User button

### Best Practices

1. **Partial Updates**: The update profile endpoint supports partial updates. Only send fields you want to change.

2. **Validation**: Always validate data on the frontend before sending requests. The API will also validate, but frontend validation provides better UX.

3. **Error Handling**: Always check the `success` field in responses and handle errors appropriately.

4. **Authentication**: Ensure the admin token is valid and not expired before making requests.

5. **Rate Limiting**: Be mindful of API rate limits when making multiple requests.

### Service Categories

Currently, services are stored with a `type` field. To distinguish between "Dedication" services and "Other Services" in the UI:
- Check the service `type` field
- Common dedication types: "Dedication", "Birthday Wish", "Anniversary", etc.
- Other service types: "Video Call", "Live Show", "Voice Message", etc.

You can filter services on the frontend based on their type to display them in separate sections.

---

## Complete API Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stars/:starId` | Get star profile |
| PUT | `/stars/:starId` | Update star profile |
| GET | `/stars/:starId/services` | Get star services |
| POST | `/stars/:starId/services` | Add service |
| PUT | `/stars/:starId/services/:serviceId` | Update service |
| DELETE | `/stars/:starId/services/:serviceId` | Delete service |
| GET | `/stars/:starId/dedication-samples` | Get dedication samples |
| POST | `/stars/:starId/dedication-samples` | Add dedication sample |
| PUT | `/stars/:starId/dedication-samples/:sampleId` | Update dedication sample |
| DELETE | `/stars/:starId/dedication-samples/:sampleId` | Delete dedication sample |
| PATCH | `/stars/:starId/status` | Block/unblock star |
| POST | `/stars/:starId/reset-password` | Reset password |
| DELETE | `/stars/:starId` | Delete star |
| PATCH | `/stars/:starId/verified` | Update verified status |
| PATCH | `/stars/:starId/intro-video` | Update intro video |
| PATCH | `/stars/:starId/feature` | Toggle featured star |

---

## Testing Examples

### Complete Profile Update Example
```bash
curl -X PUT "https://api.example.com/api/admin/management/stars/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sophia Willson",
    "email": "sophie.turner@example.com",
    "contact": "+44 223583478567",
    "country": "USA",
    "profession": "507f1f77bcf86cd799439012",
    "about": "Award-winning actress with over 10 years of experience in film and television. Known for versatile roles and dedication to craft.",
    "location": "United States",
    "preferredLanguage": "English",
    "role": "star",
    "isVerified": true,
    "status": "active",
    "availableForBookings": true,
    "hidden": false,
    "feature_star": true,
    "introVideo": "https://example.com/intro.mp4"
  }'
```

### Add Service Example
```bash
curl -X POST "https://api.example.com/api/admin/management/stars/507f1f77bcf86cd799439011/services" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Video Call",
    "price": 75
  }'
```

### Block Star Example
```bash
curl -X PATCH "https://api.example.com/api/admin/management/stars/507f1f77bcf86cd799439011/status" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "block",
    "reason": "Violation of community guidelines"
  }'
```

---

For additional API documentation, see:
- `ADMIN_MANAGEMENT_API.md` - Complete admin management APIs
- `API_DOCUMENTATION.md` - General API documentation






