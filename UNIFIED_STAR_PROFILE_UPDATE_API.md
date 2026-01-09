# Unified Star Profile Update API

## Overview
This document describes the **single unified PATCH endpoint** for updating all star profile information, including profile fields, services, dedication samples, toggles, and more.

## Endpoint
**PATCH** `/api/admin/management/user/:id`

## Authentication
- **Header**: `Authorization: Bearer <ADMIN_JWT>`
- **Content-Type**: `application/json`

## Path Parameters
- `id` (required): MongoDB ObjectId of the user/star

## Request Body
Send **only the fields you want to change**. All fields are optional.

### Basic Profile Fields

```json
{
  "name": "Sophia Willson",
  "pseudo": "sophia_w",
  "email": "sophie.turner@example.com",
  "contact": "+44 223583478567",
  "profilePic": "https://example.com/profile.jpg",
  "country": "USA",
  "profession": "64e9f0d0c3a1b20012345678",
  "category": "64e9f0d0c3a1b20012345678",
  "about": "Award-winning actress with over 10 years of experience... (minimum 100 characters)",
  "location": "United States",
  "preferredLanguage": "English"
}
```

### Toggle Fields

```json
{
  "availableForBookings": true,
  "hidden": false,
  "appNotification": true,
  "isVerified": true,
  "feature_star": true
}
```

### Role and Status

```json
{
  "role": "star",
  "status": "active"
}
```

**Status values:**
- `"active"` → Sets `availableForBookings: true`, `hidden: false`
- `"blocked"` or `"inactive"` → Sets `availableForBookings: false`, `hidden: true`

### Intro Video

```json
{
  "introVideo": "https://example.com/intro-video.mp4"
}
```

To remove intro video:
```json
{
  "introVideo": ""
}
```

### Services Management

Manage services using an array with operation objects:

```json
{
  "services": [
    {
      "operation": "add",
      "type": "Video Call",
      "price": 75
    },
    {
      "operation": "update",
      "id": "507f1f77bcf86cd799439011",
      "type": "Video Call",
      "price": 100
    },
    {
      "operation": "delete",
      "id": "507f1f77bcf86cd799439012"
    }
  ]
}
```

**Service Operations:**
- `"add"` - Add new service (requires `type` and `price`)
- `"update"` - Update existing service (requires `id`, optional `type` and `price`)
- `"delete"` - Delete service (requires `id`)

### Dedication Samples Management

Manage dedication samples using an array with operation objects:

```json
{
  "dedicationSamples": [
    {
      "operation": "add",
      "type": "Birthday Wish",
      "video": "https://example.com/video.mp4",
      "description": "Sample description"
    },
    {
      "operation": "update",
      "id": "507f1f77bcf86cd799439013",
      "type": "Anniversary Wish",
      "video": "https://example.com/new-video.mp4",
      "description": "Updated description"
    },
    {
      "operation": "delete",
      "id": "507f1f77bcf86cd799439014"
    }
  ]
}
```

**Dedication Sample Operations:**
- `"add"` - Add new sample (requires `type` and `video`)
- `"update"` - Update existing sample (requires `id`, optional `type`, `video`, `description`)
- `"delete"` - Delete sample (requires `id`)

## Complete Example Request

```json
{
  "name": "Sophia Willson",
  "email": "sophie.turner@example.com",
  "contact": "+44 223583478567",
  "profilePic": "https://example.com/new-profile.jpg",
  "country": "USA",
  "profession": "64e9f0d0c3a1b20012345678",
  "about": "Award-winning actress with over 10 years of experience in film and television. Known for versatile roles and dedication to craft.",
  "location": "United States",
  "preferredLanguage": "English",
  "role": "star",
  "isVerified": true,
  "feature_star": true,
  "status": "active",
  "availableForBookings": true,
  "hidden": false,
  "appNotification": true,
  "introVideo": "https://example.com/intro-video.mp4",
  "services": [
    {
      "operation": "add",
      "type": "Video Call",
      "price": 75
    },
    {
      "operation": "update",
      "id": "507f1f77bcf86cd799439011",
      "price": 100
    },
    {
      "operation": "delete",
      "id": "507f1f77bcf86cd799439012"
    }
  ],
  "dedicationSamples": [
    {
      "operation": "add",
      "type": "Birthday Wish",
      "video": "https://example.com/birthday.mp4",
      "description": "Birthday dedication sample"
    },
    {
      "operation": "delete",
      "id": "507f1f77bcf86cd799439013"
    }
  ]
}
```

## Response

### Success Response

```json
{
  "success": true,
  "message": "User profile updated successfully",
  "data": {
    "user": {
      "id": "user_id",
      "baroniId": "BR12345",
      "role": "star",
      "name": "Sophia Willson",
      "pseudo": "sophia_w",
      "email": "sophie.turner@example.com",
      "contact": "+44 223583478567",
      "profilePic": "https://example.com/new-profile.jpg",
      "country": "USA",
      "profession": {
        "id": "profession_id",
        "name": "Actor"
      },
      "about": "Award-winning actress...",
      "location": "United States",
      "preferredLanguage": "English",
      "availableForBookings": true,
      "hidden": false,
      "appNotification": true,
      "isVerified": true,
      "feature_star": true,
      "introVideo": "https://example.com/intro-video.mp4",
      "status": "active",
      "services": [
        {
          "id": "service_id",
          "type": "Video Call",
          "price": 75,
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "dedicationSamples": [
        {
          "id": "sample_id",
          "type": "Birthday Wish",
          "video": "https://example.com/birthday.mp4",
          "description": "Birthday dedication sample",
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Error Responses

```json
{
  "success": false,
  "message": "Error message description"
}
```

## Field Descriptions

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `name` | string | User's full name | 1-100 characters |
| `pseudo` | string | Username/pseudo | 1-50 characters |
| `email` | string | Email address | Valid email format, unique |
| `contact` | string | Phone number with country code | Max 20 characters |
| `profilePic` | string | Profile picture URL | Valid URL or empty string to remove |
| `country` | string | Country name | Max 50 characters |
| `profession` | string | Profession/Category ID | Valid MongoDB ObjectId |
| `category` | string | Same as profession (alternative) | Valid MongoDB ObjectId |
| `about` | string | Biography/About section | Minimum 100 characters if provided |
| `location` | string | Location/Address | Max 100 characters |
| `preferredLanguage` | string | Preferred language | Max 50 characters |
| `role` | string | User role | "star" or "fan" |
| `isVerified` | boolean | Verified status | true/false |
| `status` | string | Account status | "active", "blocked", or "inactive" |
| `availableForBookings` | boolean | Available for bookings toggle | true/false |
| `hidden` | boolean | Hidden mode toggle | true/false |
| `appNotification` | boolean | App notifications toggle | true/false |
| `feature_star` | boolean | Add in feature stars toggle | true/false |
| `introVideo` | string | Intro video URL | Valid URL or empty string to remove |
| `services` | array | Services operations array | See Services Management section |
| `dedicationSamples` | array | Dedication samples operations array | See Dedication Samples Management section |

## Usage Examples

### Example 1: Update Basic Profile Fields

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sophia Willson",
    "email": "sophie.turner@example.com",
    "country": "USA"
  }'
```

### Example 2: Update Toggle Buttons

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isVerified": true,
    "feature_star": true,
    "availableForBookings": true,
    "hidden": false,
    "status": "active"
  }'
```

### Example 3: Update Profile Picture

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profilePic": "https://example.com/new-profile.jpg"
  }'
```

### Example 4: Add New Service

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "services": [
      {
        "operation": "add",
        "type": "Video Call",
        "price": 75
      }
    ]
  }'
```

### Example 5: Update and Delete Services

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "services": [
      {
        "operation": "update",
        "id": "507f1f77bcf86cd799439011",
        "price": 100
      },
      {
        "operation": "delete",
        "id": "507f1f77bcf86cd799439012"
      }
    ]
  }'
```

### Example 6: Add Dedication Sample

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dedicationSamples": [
      {
        "operation": "add",
        "type": "Birthday Wish",
        "video": "https://example.com/birthday.mp4",
        "description": "Birthday dedication sample"
      }
    ]
  }'
```

### Example 7: Update Intro Video

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "introVideo": "https://example.com/new-intro.mp4"
  }'
```

### Example 8: Remove Intro Video

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "introVideo": ""
  }'
```

### Example 9: Complete Update (All Fields)

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sophia Willson",
    "pseudo": "sophia_w",
    "email": "sophie.turner@example.com",
    "contact": "+44 223583478567",
    "profilePic": "https://example.com/profile.jpg",
    "country": "USA",
    "profession": "64e9f0d0c3a1b20012345678",
    "about": "Award-winning actress with over 10 years of experience in film and television. Known for versatile roles and dedication to craft.",
    "location": "United States",
    "preferredLanguage": "English",
    "role": "star",
    "isVerified": true,
    "feature_star": true,
    "status": "active",
    "availableForBookings": true,
    "hidden": false,
    "appNotification": true,
    "introVideo": "https://example.com/intro.mp4",
    "services": [
      {
        "operation": "add",
        "type": "Video Call",
        "price": 75
      },
      {
        "operation": "add",
        "type": "Dedication",
        "price": 150
      }
    ],
    "dedicationSamples": [
      {
        "operation": "add",
        "type": "Birthday Wish",
        "video": "https://example.com/birthday.mp4",
        "description": "Birthday sample"
      }
    ]
  }'
```

## Important Notes

### Partial Updates
- **Only send fields you want to change** - All fields are optional
- You can update just one field or multiple fields in a single request
- Services and dedication samples can be managed independently or together

### Services Management
- Services operations are processed in order
- You can add, update, and delete multiple services in one request
- For `add` operation: `type` and `price` are required
- For `update` operation: `id` is required, `type` and `price` are optional
- For `delete` operation: `id` is required
- Duplicate service types are not allowed (will return 409 error)

### Dedication Samples Management
- Sample operations are processed in order
- You can add, update, and delete multiple samples in one request
- For `add` operation: `type` and `video` are required, `description` is optional
- For `update` operation: `id` is required, `type`, `video`, and `description` are optional
- For `delete` operation: `id` is required

### About Field
- If provided, must be at least 100 characters
- Can be empty string or null to clear the field

### Profile Picture & Intro Video
- Must be valid URL if provided
- Can be empty string to remove/clear

### Status Field
- `"active"` → Sets `availableForBookings: true`, `hidden: false`
- `"blocked"` or `"inactive"` → Sets `availableForBookings: false`, `hidden: true`

### Email Uniqueness
- Email must be unique across all users
- If changing email, API will check for conflicts

### Star-Only Features
- Services and dedication samples management only works for users with `role: "star"`
- These fields are ignored for fans

## Error Handling

### Common Errors

**400 Bad Request:**
- Invalid field format
- Missing required fields for operations
- About field less than 100 characters

**404 Not Found:**
- User not found
- Service/Sample ID not found

**409 Conflict:**
- Email already in use
- Service type already exists

**403 Forbidden:**
- Not an admin user
- Invalid or missing token

**500 Internal Server Error:**
- Server error during processing

## Frontend Implementation Tips

1. **Collect Changes**: Track all changes made in the edit screen
2. **Build Request**: Construct request body with only changed fields
3. **Handle Services**: For services, collect all operations (add/update/delete) and send in one array
4. **Handle Samples**: For dedication samples, collect all operations and send in one array
5. **Toggle States**: Send boolean values for all toggle switches
6. **Profile Picture**: Send new URL when changed, or empty string to remove
7. **Single Request**: Send all changes in one PATCH request for better performance

## Screen Mapping

### Edit Profile Screen → API Fields

| Screen Element | API Field | Notes |
|---------------|-----------|-------|
| Profile Picture | `profilePic` | URL or empty string |
| Role Toggle | `role` | "star" or "fan" |
| Verified Toggle | `isVerified` | boolean |
| Name Field | `name` | string |
| Profession Field | `profession` or `category` | ObjectId |
| Email Field | `email` | string |
| Phone Field | `contact` | string |
| Language Dropdown | `preferredLanguage` | string |
| Category Dropdown | `profession` | ObjectId |
| Country Dropdown | `country` | string |
| About Text Area | `about` | min 100 chars |
| Status Dropdown | `status` | "active"/"blocked"/"inactive" |
| Dedication Services | `services` array | with operations |
| Other Services | `services` array | with operations |
| Intro Video | `introVideo` | URL or empty string |
| Sample Dedications | `dedicationSamples` array | with operations |

### View Profile Screen Toggles → API Fields

| Toggle | API Field | Notes |
|--------|-----------|-------|
| Available for Bookings | `availableForBookings` | boolean |
| Hidden Mode | `hidden` | boolean |
| Add In Feature Stars | `feature_star` | boolean |
| Online Star | Computed from `lastLoginAt` | Read-only |

---

For complete API documentation, see:
- `STAR_PROFILE_MANAGEMENT_API.md` - Detailed star profile APIs
- `ADMIN_MANAGEMENT_API.md` - Complete admin management APIs














