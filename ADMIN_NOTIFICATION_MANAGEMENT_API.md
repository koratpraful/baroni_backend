# Admin Notification Management API Documentation

This document describes the admin notification management APIs for managing notifications, templates, and scheduled notifications.

## Overview

The admin notification management system provides APIs for:
1. Creating and sending notifications immediately
2. Managing notification templates
3. Viewing notification history
4. Scheduling notifications for future delivery

## Base URL

All endpoints are prefixed with `/api/admin/notifications`

## Authentication

All endpoints require:
- Authentication via `requireAuth` middleware
- Admin role via `requireRole('admin')` middleware

## API Endpoints

### 1. Create and Send Notification Immediately

**POST** `/api/admin/notifications/create`

Create and send a notification immediately to selected users.

#### Request Body

```json
{
  "notificationType": "Push",  // Required: "Push", "SMS", or "Email"
  "sessionTitle": "Spiritual Talk - Sunday Healing",  // Optional
  "message": "Write Body Message",  // Required
  "targetAudience": "All Fans",  // Required: "All Fans", "All Stars", "All Users", "By Country", "Specific Users"
  "country": "India",  // Optional: Required if targetAudience is "By Country"
  "userIds": ["userId1", "userId2"]  // Optional: Required if targetAudience is "Specific Users"
}
```

#### Response

```json
{
  "success": true,
  "message": "Notification sent successfully",
  "data": {
    "totalUsers": 150,
    "successCount": 148,
    "failureCount": 2,
    "notificationType": "Push",
    "targetAudience": "All Fans",
    "country": null
  }
}
```

---

### 2. Create Notification Template

**POST** `/api/admin/notifications/templates`

Create a new notification template.

#### Request Body

```json
{
  "service": "Live Show",  // Required: "Live Show", "Video Call", "Dedication", "General"
  "notificationType": "Push",  // Required: "Push", "SMS", "Email"
  "message": "Write Body Message",  // Required
  "category": "Live Shows"  // Optional: "Video Calls", "Dedications", "Live Shows", "General" (auto-mapped from service if not provided)
}
```

#### Response

```json
{
  "success": true,
  "message": "Notification template created successfully",
  "data": {
    "_id": "templateId",
    "service": "Live Show",
    "notificationType": "Push",
    "message": "Write Body Message",
    "category": "Live Shows",
    "createdBy": "adminId",
    "usageCount": 0,
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T10:00:00.000Z"
  }
}
```

---

### 3. Get Notification Templates

**GET** `/api/admin/notifications/templates`

Get all notification templates with filtering and pagination.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | String | null | Filter by category: "Video Calls", "Dedications", "Live Shows", "General", or "All" |
| `notificationType` | String | null | Filter by type: "Push", "SMS", "Email", or "All" |
| `search` | String | null | Search in message and service fields |
| `page` | Integer | 1 | Page number |
| `limit` | Integer | 20 | Items per page |

#### Response

```json
{
  "success": true,
  "message": "Notification templates retrieved successfully",
  "data": {
    "templates": [
      {
        "_id": "templateId",
        "service": "Live Show",
        "notificationType": "Push",
        "message": "Hi Riya, your live show starts in 15 min. Get ready to connect with your fans!",
        "category": "Live Shows",
        "createdBy": {
          "_id": "adminId",
          "name": "Admin Name",
          "pseudo": "admin"
        },
        "usageCount": 5,
        "lastUsedAt": "2025-01-20T10:00:00.000Z",
        "createdAt": "2025-01-20T10:00:00.000Z",
        "updatedAt": "2025-01-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalTemplates": 100,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 20
    }
  }
}
```

---

### 4. Update Notification Template

**PUT** `/api/admin/notifications/templates/:id`

Update an existing notification template.

#### Request Body

```json
{
  "service": "Live Show",  // Optional
  "notificationType": "Push",  // Optional
  "message": "Updated message",  // Optional
  "category": "Live Shows"  // Optional
}
```

#### Response

```json
{
  "success": true,
  "message": "Template updated successfully",
  "data": {
    "_id": "templateId",
    "service": "Live Show",
    "notificationType": "Push",
    "message": "Updated message",
    "category": "Live Shows",
    "createdBy": "adminId",
    "usageCount": 5,
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T11:00:00.000Z"
  }
}
```

---

### 5. Delete Notification Template

**DELETE** `/api/admin/notifications/templates/:id`

Delete a notification template.

#### Response

```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

---

### 6. Get Notification History

**GET** `/api/admin/notifications/history`

Get notification history with filtering and pagination.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | String | null | Filter by type: "All", "SMS", "Email", or "Push" |
| `search` | String | null | Search in title and message fields |
| `page` | Integer | 1 | Page number |
| `limit` | Integer | 20 | Items per page |

#### Response

```json
{
  "success": true,
  "message": "Notification history retrieved successfully",
  "data": {
    "notifications": [
      {
        "_id": "notificationId",
        "title": "Live show starting",
        "message": "Hi Riya, your live show starts in 15 min. Get ready to connect with your fans!",
        "notificationType": "Push",
        "lastUsedAt": "2025-01-20T10:00:00.000Z",
        "time": "2:30 PM",
        "date": "4 Jan 2025",
        "audience": "All Fans",
        "user": {
          "_id": "userId",
          "name": "User Name",
          "pseudo": "user",
          "country": "India",
          "role": "fan"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalNotifications": 200,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 20
    }
  }
}
```

---

### 7. Schedule Notification

**POST** `/api/admin/notifications/schedule`

Schedule a notification for future delivery.

#### Request Body

```json
{
  "title": "Live show starting",  // Required
  "body": "Hi Riya, your live show starts in 15 min. Get ready to connect with your fans!",  // Required
  "notificationType": "Push",  // Required: "Push", "SMS", or "Email"
  "sessionTitle": "Spiritual Talk - Sunday Healing",  // Optional
  "targetAudience": "All Fans",  // Required: "All Fans", "All Stars", "All Users", "By Country", "Specific Users"
  "country": "India",  // Optional: Required if targetAudience is "By Country"
  "scheduledAt": "2025-07-25T10:00:00.000Z",  // Required: Future date/time
  "userIds": ["userId1", "userId2"]  // Optional: Required if targetAudience is "Specific Users"
}
```

#### Response

```json
{
  "success": true,
  "message": "Notification scheduled successfully",
  "data": {
    "_id": "scheduledNotificationId",
    "title": "Live show starting",
    "body": "Hi Riya, your live show starts in 15 min. Get ready to connect with your fans!",
    "notificationType": "Push",
    "sessionTitle": "Spiritual Talk - Sunday Healing",
    "targetAudience": "All Fans",
    "country": null,
    "scheduledAt": "2025-07-25T10:00:00.000Z",
    "status": "scheduled",
    "createdBy": "adminId",
    "createdAt": "2025-01-20T10:00:00.000Z",
    "updatedAt": "2025-01-20T10:00:00.000Z"
  }
}
```

---

### 8. Get Scheduled Notifications

**GET** `/api/admin/notifications/scheduled`

Get all scheduled notifications with filtering and pagination.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `notificationType` | String | null | Filter by type: "All", "Push", "SMS", or "Email" |
| `search` | String | null | Search in title, body, and sessionTitle fields |
| `page` | Integer | 1 | Page number |
| `limit` | Integer | 20 | Items per page |

#### Response

```json
{
  "success": true,
  "message": "Scheduled notifications retrieved successfully",
  "data": {
    "scheduledNotifications": [
      {
        "_id": "scheduledNotificationId",
        "title": "Live show starting",
        "body": "Hi Riya, your live show starts in 15 min. Get ready to connect with your fans!",
        "notificationType": "Push",
        "sessionTitle": "Spiritual Talk - Sunday Healing",
        "targetAudience": "All Fans",
        "country": null,
        "scheduledAt": "2025-07-25T10:00:00.000Z",
        "status": "scheduled",
        "createdBy": {
          "_id": "adminId",
          "name": "Admin Name",
          "pseudo": "admin"
        },
        "sentCount": 0,
        "failedCount": 0,
        "createdAt": "2025-01-20T10:00:00.000Z",
        "updatedAt": "2025-01-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalScheduled": 100,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 20
    }
  }
}
```

---

### 9. Update Scheduled Notification

**PUT** `/api/admin/notifications/scheduled/:id`

Update a scheduled notification (only if status is "scheduled").

#### Request Body

```json
{
  "title": "Updated title",  // Optional
  "body": "Updated body",  // Optional
  "notificationType": "Push",  // Optional
  "sessionTitle": "Updated session title",  // Optional
  "targetAudience": "All Fans",  // Optional
  "country": "India",  // Optional
  "scheduledAt": "2025-07-26T10:00:00.000Z",  // Optional: Must be future date
  "userIds": ["userId1", "userId2"]  // Optional
}
```

#### Response

```json
{
  "success": true,
  "message": "Scheduled notification updated successfully",
  "data": {
    "_id": "scheduledNotificationId",
    "title": "Updated title",
    "body": "Updated body",
    "notificationType": "Push",
    "scheduledAt": "2025-07-26T10:00:00.000Z",
    "status": "scheduled",
    "updatedAt": "2025-01-20T11:00:00.000Z"
  }
}
```

---

### 10. Delete Scheduled Notification

**DELETE** `/api/admin/notifications/scheduled/:id`

Delete a scheduled notification.

#### Response

```json
{
  "success": true,
  "message": "Scheduled notification deleted successfully"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
  "success": false,
  "message": "Error message describing what went wrong"
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
  "message": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error message"
}
```

---

## Database Models

### NotificationTemplate

```javascript
{
  service: String,  // "Live Show", "Video Call", "Dedication", "General"
  notificationType: String,  // "Push", "SMS", "Email"
  message: String,
  category: String,  // "Video Calls", "Dedications", "Live Shows", "General"
  createdBy: ObjectId,  // Reference to User (admin)
  lastUsedAt: Date,
  usageCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### ScheduledNotification

```javascript
{
  title: String,
  body: String,
  notificationType: String,  // "Push", "SMS", "Email"
  sessionTitle: String,
  targetAudience: String,  // "All Fans", "All Stars", "All Users", "By Country", "Specific Users"
  country: String,
  userIds: [ObjectId],  // Array of User IDs
  scheduledAt: Date,
  status: String,  // "scheduled", "sent", "cancelled", "failed"
  sentAt: Date,
  createdBy: ObjectId,  // Reference to User (admin)
  sentCount: Number,
  failedCount: Number,
  failureReason: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Notes

1. **SMS and Email Integration**: Currently, SMS and Email notifications are marked as sent but not actually sent. Integration with SMS and Email services is required (marked with TODO comments in the code).

2. **Scheduled Notifications**: Scheduled notifications are stored in the database but require a job scheduler (e.g., node-cron, agenda) to actually send them at the scheduled time (marked with TODO comments in the code).

3. **Target Audience**:
   - "All Fans": All users with role "fan"
   - "All Stars": All users with role "star"
   - "All Users": All users regardless of role
   - "By Country": Users from a specific country (requires `country` field)
   - "Specific Users": Specific user IDs (requires `userIds` array)

4. **Country Filtering**: The country field can be combined with target audience filters (e.g., "All Fans" + country = all fans from that country).

5. **Pagination**: All list endpoints support pagination with `page` and `limit` query parameters.

6. **Search**: List endpoints support search functionality across relevant text fields.

