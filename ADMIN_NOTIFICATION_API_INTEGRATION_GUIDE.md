# Admin Notification Management API - Frontend Integration Guide

## Overview
This guide provides complete API integration instructions for the Admin Notification Management screens. All APIs require admin authentication.

**Base URL:** `/api/admin/notifications`

**Authentication:** All endpoints require:
- `Authorization: Bearer <admin_token>` header
- Admin role verification

---

## 📱 Screen 1: Notification Manager (Main Screen)

### Get Notification Templates & History
This screen shows templates and history with filters.

**Endpoint:** `GET /api/admin/notifications/templates`

**Query Parameters:**
- `category` (optional): Filter by service category
  - Values: `"Video Calls"`, `"Dedications"`, `"Live Shows"`, `"General"`, `"All"`
- `notificationType` (optional): Filter by notification type
  - Values: `"Push"`, `"SMS"`, `"Email"`, `"All"`
- `search` (optional): Search in message or service
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Example Request:**
```dart
// Flutter/Dart Example
final response = await http.get(
  Uri.parse('$baseUrl/api/admin/notifications/templates?category=Live Shows&notificationType=Push&page=1&limit=20'),
  headers: {
    'Authorization': 'Bearer $adminToken',
    'Content-Type': 'application/json',
  },
);
```

**Response:**
```json
{
  "success": true,
  "message": "Notification templates retrieved successfully",
  "data": {
    "templates": [
      {
        "_id": "template_id",
        "service": "Live Show",
        "notificationType": "Push",
        "message": "Hi Riya, your live show starts in 15 min. Get ready to connect with your fans!",
        "category": "Live Shows",
        "lastUsedAt": "2025-07-25T10:30:00.000Z",
        "usageCount": 5,
        "createdAt": "2025-01-15T08:00:00.000Z",
        "updatedAt": "2025-07-25T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalTemplates": 45,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 20
    }
  }
}
```

**Display Format:**
- Show `message` as the notification text
- Show `notificationType` badge (Push/SMS/Email)
- Show `lastUsedAt` formatted as "Last used at 25 July 2025"
- Show edit and delete buttons for each template

---

## 📱 Screen 2: Create Notification

### Send Notification Immediately
**Endpoint:** `POST /api/admin/notifications/create`

**Request Body:**
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

**Example Request (Flutter/Dart):**
```dart
final response = await http.post(
  Uri.parse('$baseUrl/api/admin/notifications/create'),
  headers: {
    'Authorization': 'Bearer $adminToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'notificationType': 'Push', // or 'SMS' or 'Email'
    'sessionTitle': 'Spiritual Talk - Sunday Healing',
    'message': 'Your live show starts in 15 minutes!',
    'targetAudience': 'All Fans', // or 'All Stars', 'All Users', 'By Country', 'Specific Users'
    'country': 'India', // Required only if targetAudience is 'By Country'
    // 'userIds': ['userId1', 'userId2'] // Required only if targetAudience is 'Specific Users'
  }),
);
```

**Response:**
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

**Important Notes:**
- For **Push notifications**: Only sends to users with `appNotification: true`
- For **SMS**: Only sends to users with valid `contact` (phone number)
- For **Email**: Only sends to users with valid `email` address
- If no users found matching criteria, returns 404 error

---

## 📱 Screen 3: Notification History

### Get Notification History
**Endpoint:** `GET /api/admin/notifications/history`

**Query Parameters:**
- `type` (optional): Filter by notification type
  - Values: `"Push"`, `"SMS"`, `"Email"`, `"All"`
- `search` (optional): Search in title or message
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Example Request:**
```dart
final response = await http.get(
  Uri.parse('$baseUrl/api/admin/notifications/history?type=Push&page=1&limit=20'),
  headers: {
    'Authorization': 'Bearer $adminToken',
    'Content-Type': 'application/json',
  },
);
```

**Response:**
```json
{
  "success": true,
  "message": "Notification history retrieved successfully",
  "data": {
    "notifications": [
      {
        "_id": "notification_id",
        "title": "Live show starting",
        "message": "Hi Riya, your live show starts in 15 min. Get ready to connect with your fans!",
        "notificationType": "Push",
        "lastUsedAt": "2025-01-04T14:30:00.000Z",
        "time": "2:30 PM",
        "date": "4 Jan 2025",
        "audience": "All Fans",
        "sentCount": 150
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalNotifications": 89,
      "hasNextPage": true,
      "hasPrevPage": false,
      "limit": 20
    }
  }
}
```

**Display Format:**
- Show `title` as notification title
- Show `notificationType` badge (Push/SMS/Email)
- Show `lastUsedAt` formatted as "Last Used at 4 Jan 2025" with time "2:30 PM"
- Show `message` as notification body
- Show `audience` as "Audience: All Fans"
- Show `sentCount` to indicate how many users received it

**Note:** History shows **grouped notifications** (unique by title+body+type), not individual user notifications.

---

## 📱 Screen 4: Notification Templates

### Get Templates (Same as Screen 1)
Use the same endpoint: `GET /api/admin/notifications/templates`

### Create Template
**Endpoint:** `POST /api/admin/notifications/templates`

**Request Body:**
```json
{
  "service": "Live Show",  // Required: "Live Show", "Video Call", "Dedication", "General"
  "notificationType": "Push",  // Required: "Push", "SMS", "Email"
  "message": "Hi Riya, your live show starts in 15 min. Get ready to connect with your fans!",  // Required
  "category": "Live Shows"  // Optional: Auto-mapped from service if not provided
}
```

**Example Request:**
```dart
final response = await http.post(
  Uri.parse('$baseUrl/api/admin/notifications/templates'),
  headers: {
    'Authorization': 'Bearer $adminToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'service': 'Live Show', // or 'Video Call', 'Dedication', 'General'
    'notificationType': 'Push', // or 'SMS', 'Email'
    'message': 'Your notification message here',
    // 'category': 'Live Shows' // Optional, auto-mapped from service
  }),
);
```

**Response:**
```json
{
  "success": true,
  "message": "Notification template created successfully",
  "data": {
    "_id": "template_id",
    "service": "Live Show",
    "notificationType": "Push",
    "message": "Your notification message here",
    "category": "Live Shows",
    "createdBy": "admin_id",
    "lastUsedAt": null,
    "usageCount": 0,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

### Update Template
**Endpoint:** `PUT /api/admin/notifications/templates/:id`

**Request Body:** (All fields optional)
```json
{
  "service": "Live Show",
  "notificationType": "SMS",
  "message": "Updated message",
  "category": "Live Shows"
}
```

**Example Request:**
```dart
final response = await http.put(
  Uri.parse('$baseUrl/api/admin/notifications/templates/$templateId'),
  headers: {
    'Authorization': 'Bearer $adminToken',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'message': 'Updated notification message',
    // Other fields are optional
  }),
);
```

### Delete Template
**Endpoint:** `DELETE /api/admin/notifications/templates/:id`

**Example Request:**
```dart
final response = await http.delete(
  Uri.parse('$baseUrl/api/admin/notifications/templates/$templateId'),
  headers: {
    'Authorization': 'Bearer $adminToken',
    'Content-Type': 'application/json',
  },
);
```

**Response:**
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

---

## 📱 Screen 5: Create Template

Use the same **Create Template** endpoint as Screen 4.

---

## 🔧 Additional Features

### Scheduled Notifications

#### Schedule a Notification
**Endpoint:** `POST /api/admin/notifications/schedule`

**Request Body:**
```json
{
  "title": "Notification Title",
  "body": "Notification message",
  "notificationType": "Push",
  "sessionTitle": "Optional session title",
  "targetAudience": "All Fans",
  "country": "India",
  "scheduledAt": "2025-02-01T10:00:00.000Z",  // ISO 8601 format, must be future date
  "userIds": []  // Optional, for "Specific Users" audience
}
```

#### Get Scheduled Notifications
**Endpoint:** `GET /api/admin/notifications/scheduled`

**Query Parameters:**
- `status` (optional): `"scheduled"`, `"sent"`, `"cancelled"`, `"failed"`
- `page`, `limit` for pagination

#### Update Scheduled Notification
**Endpoint:** `PUT /api/admin/notifications/scheduled/:id`

#### Delete Scheduled Notification
**Endpoint:** `DELETE /api/admin/notifications/scheduled/:id`

---

## 📋 Field Values Reference

### Notification Types
- `"Push"` - Push notification (app notification)
- `"SMS"` - SMS message
- `"Email"` - Email message

### Target Audience
- `"All Fans"` - All users with role "fan"
- `"All Stars"` - All users with role "star"
- `"All Users"` - All users (fans + stars)
- `"By Country"` - Users from specific country (requires `country` field)
- `"Specific Users"` - Specific user IDs (requires `userIds` array)

### Services
- `"Live Show"` - Live show notifications
- `"Video Call"` - Video call notifications
- `"Dedication"` - Dedication notifications
- `"General"` - General notifications

### Categories
- `"Live Shows"` - Maps from "Live Show" service
- `"Video Calls"` - Maps from "Video Call" service
- `"Dedications"` - Maps from "Dedication" service
- `"General"` - Maps from "General" service

---

## ⚠️ Error Handling

All APIs return errors in this format:

```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error message (optional)"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (validation errors)
- `403` - Forbidden (not admin)
- `404` - Not Found (no users/templates found)
- `500` - Internal Server Error

**Example Error Response:**
```json
{
  "success": false,
  "message": "No users found matching the criteria"
}
```

---

## 🎨 UI Integration Tips

1. **Filter Tabs:**
   - "All" = Don't send filter parameter or send `"All"`
   - "Push" = Send `notificationType=Push`
   - "SMS" = Send `notificationType=SMS`
   - "Email" = Send `notificationType=Email`

2. **Service Filter Tabs:**
   - "Video Calls" = Send `category=Video Calls`
   - "Dedications" = Send `category=Dedications`
   - "Live Shows" = Send `category=Live Shows`

3. **Date Formatting:**
   - Use `lastUsedAt` field from API
   - Format as: "Last used at 25 July 2025"
   - Time format: "2:30 PM" (12-hour format)

4. **Loading States:**
   - Show loading indicator while API calls are in progress
   - Handle pagination with "Load More" or infinite scroll

5. **Success/Error Messages:**
   - Show success toast when notification sent successfully
   - Display `successCount` and `failureCount` from response
   - Show error messages from API response

---

## 📝 Complete Example (Flutter/Dart)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class NotificationService {
  final String baseUrl = 'http://your-api-url.com';
  final String adminToken;

  NotificationService(this.adminToken);

  // Get Templates
  Future<Map<String, dynamic>> getTemplates({
    String? category,
    String? notificationType,
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = {
      if (category != null && category != 'All') 'category': category,
      if (notificationType != null && notificationType != 'All') 
        'notificationType': notificationType,
      if (search != null) 'search': search,
      'page': page.toString(),
      'limit': limit.toString(),
    };

    final uri = Uri.parse('$baseUrl/api/admin/notifications/templates')
        .replace(queryParameters: queryParams);

    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $adminToken',
        'Content-Type': 'application/json',
      },
    );

    return jsonDecode(response.body);
  }

  // Send Notification
  Future<Map<String, dynamic>> sendNotification({
    required String notificationType,
    required String message,
    required String targetAudience,
    String? sessionTitle,
    String? country,
    List<String>? userIds,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/admin/notifications/create'),
      headers: {
        'Authorization': 'Bearer $adminToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'notificationType': notificationType,
        'message': message,
        'targetAudience': targetAudience,
        if (sessionTitle != null) 'sessionTitle': sessionTitle,
        if (country != null) 'country': country,
        if (userIds != null) 'userIds': userIds,
      }),
    );

    return jsonDecode(response.body);
  }

  // Get History
  Future<Map<String, dynamic>> getHistory({
    String? type,
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = {
      if (type != null && type != 'All') 'type': type,
      if (search != null) 'search': search,
      'page': page.toString(),
      'limit': limit.toString(),
    };

    final uri = Uri.parse('$baseUrl/api/admin/notifications/history')
        .replace(queryParameters: queryParams);

    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $adminToken',
        'Content-Type': 'application/json',
      },
    );

    return jsonDecode(response.body);
  }

  // Create Template
  Future<Map<String, dynamic>> createTemplate({
    required String service,
    required String notificationType,
    required String message,
    String? category,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/admin/notifications/templates'),
      headers: {
        'Authorization': 'Bearer $adminToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'service': service,
        'notificationType': notificationType,
        'message': message,
        if (category != null) 'category': category,
      }),
    );

    return jsonDecode(response.body);
  }

  // Update Template
  Future<Map<String, dynamic>> updateTemplate(
    String templateId, {
    String? service,
    String? notificationType,
    String? message,
    String? category,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/api/admin/notifications/templates/$templateId'),
      headers: {
        'Authorization': 'Bearer $adminToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        if (service != null) 'service': service,
        if (notificationType != null) 'notificationType': notificationType,
        if (message != null) 'message': message,
        if (category != null) 'category': category,
      }),
    );

    return jsonDecode(response.body);
  }

  // Delete Template
  Future<Map<String, dynamic>> deleteTemplate(String templateId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/admin/notifications/templates/$templateId'),
      headers: {
        'Authorization': 'Bearer $adminToken',
        'Content-Type': 'application/json',
      },
    );

    return jsonDecode(response.body);
  }
}
```

---

## ✅ Testing Checklist

- [ ] Get templates with all filter combinations
- [ ] Create and send Push notification
- [ ] Create and send SMS notification
- [ ] Create and send Email notification
- [ ] Test all target audience options
- [ ] Test country filter
- [ ] Test specific users selection
- [ ] Get notification history with filters
- [ ] Create notification template
- [ ] Update notification template
- [ ] Delete notification template
- [ ] Handle error responses properly
- [ ] Test pagination
- [ ] Test search functionality

---

**For any questions or issues, contact the backend team.**
