# Admin Notification Management - API Integration Message

## Hello Frontend Developer! 👋

Admin notification management માટે બધી APIs ready છે. નીચે મુજબ integration કરો:

## 🔗 Base URL
```
/api/admin/notifications
```

**Authentication:** બધી APIs માટે `Authorization: Bearer <admin_token>` header required છે.

---

## 📱 Screen-wise API Mapping

### 1. Notification Manager Screen (Main Screen)
**Get Templates:**
```
GET /api/admin/notifications/templates?category=Live Shows&notificationType=Push&page=1&limit=20
```

**Query Parameters:**
- `category`: "Video Calls", "Dedications", "Live Shows", "General", "All"
- `notificationType`: "Push", "SMS", "Email", "All"
- `search`: Search text
- `page`, `limit`: Pagination

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "_id": "id",
        "service": "Live Show",
        "notificationType": "Push",
        "message": "Your message here",
        "lastUsedAt": "2025-07-25T10:30:00.000Z",
        "usageCount": 5
      }
    ],
    "pagination": { ... }
  }
}
```

---

### 2. Create Notification Screen
**Send Notification:**
```
POST /api/admin/notifications/create
```

**Request Body:**
```json
{
  "notificationType": "Push",  // "Push", "SMS", or "Email"
  "sessionTitle": "Spiritual Talk - Sunday Healing",  // Optional
  "message": "Your notification message",  // Required
  "targetAudience": "All Fans",  // "All Fans", "All Stars", "All Users", "By Country", "Specific Users"
  "country": "India",  // Required if targetAudience is "By Country"
  "userIds": ["id1", "id2"]  // Required if targetAudience is "Specific Users"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "successCount": 148,
    "failureCount": 2,
    "notificationType": "Push"
  }
}
```

---

### 3. Notification History Screen
**Get History:**
```
GET /api/admin/notifications/history?type=Push&page=1&limit=20
```

**Query Parameters:**
- `type`: "Push", "SMS", "Email", "All"
- `search`: Search text
- `page`, `limit`: Pagination

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "id",
        "title": "Live show starting",
        "message": "Your message",
        "notificationType": "Push",
        "lastUsedAt": "2025-01-04T14:30:00.000Z",
        "time": "2:30 PM",
        "date": "4 Jan 2025",
        "audience": "All Fans",
        "sentCount": 150
      }
    ],
    "pagination": { ... }
  }
}
```

**Note:** History shows **grouped notifications** (unique by title+body+type), not individual user notifications.

---

### 4. Notification Templates Screen
**Same as Screen 1** - Use `GET /api/admin/notifications/templates`

**Create Template:**
```
POST /api/admin/notifications/templates
```

**Request Body:**
```json
{
  "service": "Live Show",  // "Live Show", "Video Call", "Dedication", "General"
  "notificationType": "Push",  // "Push", "SMS", "Email"
  "message": "Your template message"  // Required
}
```

**Update Template:**
```
PUT /api/admin/notifications/templates/:id
```

**Delete Template:**
```
DELETE /api/admin/notifications/templates/:id
```

---

### 5. Create Template Screen
**Same as Screen 4** - Use `POST /api/admin/notifications/templates`

---

## 📋 Important Notes

1. **Notification Types:**
   - `Push` - App push notification
   - `SMS` - SMS message (requires valid phone number)
   - `Email` - Email message (requires valid email address)

2. **Target Audience:**
   - `All Fans` - All users with role "fan"
   - `All Stars` - All users with role "star"
   - `All Users` - All users
   - `By Country` - Requires `country` field
   - `Specific Users` - Requires `userIds` array

3. **Date Formatting:**
   - `lastUsedAt` field માંથી format કરો
   - Format: "Last used at 25 July 2025"
   - Time: "2:30 PM" (12-hour format)

4. **Error Handling:**
   - All errors return: `{ "success": false, "message": "error message" }`
   - Check `success` field before using data

---

## 🎯 Quick Integration Example (Dart/Flutter)

```dart
// Get Templates
final response = await http.get(
  Uri.parse('$baseUrl/api/admin/notifications/templates?category=Live Shows&notificationType=Push'),
  headers: {'Authorization': 'Bearer $token'},
);

// Send Notification
final response = await http.post(
  Uri.parse('$baseUrl/api/admin/notifications/create'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'notificationType': 'Push',
    'message': 'Your message',
    'targetAudience': 'All Fans',
  }),
);
```

---

## 📖 Complete Documentation

વધુ details માટે `ADMIN_NOTIFICATION_API_INTEGRATION_GUIDE.md` file check કરો.

---

**Questions? Contact backend team!** 🚀
