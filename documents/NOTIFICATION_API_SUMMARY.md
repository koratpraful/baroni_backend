# Notification API - Implementation Summary

## Overview
Admin માટે push notifications send કરવાની API. આ API દ્વારા admin users ને notifications send કરી શકે છે.

## API Endpoint
```
POST /api/admin/notifications/create
```

## Authentication
- **Required**: Admin authentication
- **Header**: `Authorization: Bearer <admin_token>`

## Request Body

```json
{
  "notificationType": "Push",           // Required: "Push", "SMS", or "Email"
  "sessionTitle": "Spiritual Talk",    // Optional: Notification title (defaults to "Notification")
  "message": "Your message here",       // Required: Notification body message
  "targetAudience": "All Fans",         // Required: "All Fans", "All Stars", "All Users", "By Country", or "Specific Users"
  "country": "भारत",                    // Optional: Filter by country
  "userIds": []                         // Optional: Required if targetAudience is "Specific Users"
}
```

## Target Audience Options

1. **"All Fans"** - All users with role 'fan'
   - Optional: Filter by country
   
2. **"All Stars"** - All users with role 'star'
   - Optional: Filter by country
   
3. **"All Users"** - All users (fans + stars)
   - Optional: Filter by country
   
4. **"By Country"** - Users from specific country
   - Required: `country` field must be provided
   
5. **"Specific Users"** - Specific user IDs
   - Required: `userIds` array must be provided with valid ObjectIds

## Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "data": {
    "totalUsers": 150,
    "successCount": 145,
    "failureCount": 5,
    "notificationType": "Push",
    "targetAudience": "All Fans",
    "country": "भारत"
  }
}
```

### Error Responses

**400 Bad Request** - Missing required fields
```json
{
  "success": false,
  "message": "Notification type and message are required"
}
```

**400 Bad Request** - Invalid target audience
```json
{
  "success": false,
  "message": "Target audience is required. Must be one of: All Fans, All Stars, All Users, By Country, Specific Users"
}
```

**404 Not Found** - No users found
```json
{
  "success": false,
  "message": "No users found matching the criteria"
}
```

**403 Forbidden** - Not admin
```json
{
  "success": false,
  "message": "Admin access required"
}
```

## Implementation Details

### Features
1. ✅ **Push Notification Support** - Sends push notifications via Firebase/APNs
2. ✅ **User Filtering** - Filter by role (fan/star) and country
3. ✅ **Notification Settings** - Only sends to users with `appNotification: true`
4. ✅ **Bulk Sending** - Sends to multiple users efficiently
5. ✅ **Error Handling** - Returns success/failure counts

### Code Location
- **Controller**: `baroni_backend/controllers/adminNotificationManagement.js`
- **Route**: `baroni_backend/routes/api/adminNotificationManagement.js`
- **Service**: Uses `notificationService.sendToMultipleUsers()`

### Key Logic
1. Validates notification type and message
2. Builds user query based on target audience
3. Filters users with `appNotification: true`
4. Sends notifications via notification service
5. Returns success/failure statistics

## Example Usage

### Send to All Fans
```bash
POST /api/admin/notifications/create
{
  "notificationType": "Push",
  "sessionTitle": "New Event",
  "message": "Join us for a special event!",
  "targetAudience": "All Fans"
}
```

### Send to All Stars in India
```bash
POST /api/admin/notifications/create
{
  "notificationType": "Push",
  "sessionTitle": "Important Update",
  "message": "Check your dashboard for updates",
  "targetAudience": "All Stars",
  "country": "भारत"
}
```

### Send to Specific Users
```bash
POST /api/admin/notifications/create
{
  "notificationType": "Push",
  "message": "Personal notification",
  "targetAudience": "Specific Users",
  "userIds": ["507f1f77bcf86cd799439011", "507f191e810c19729de860ea"]
}
```

## Notes
- Only users with `appNotification: true` receive notifications
- Deleted users (`isDeleted: true`) are excluded
- SMS and Email types are supported but not fully implemented (TODO)
- Notifications are sent asynchronously via notification service

