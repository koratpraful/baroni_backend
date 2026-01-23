# Notification Template - Category Values

## Valid Category Values (new, simple format)

For the **Notification Templates API**, use these exact `category` values:

### ✅ Valid Categories:

1. **`video_calls`**
   - For video call/appointment notifications
   - Example: `category=video_calls`

2. **`dedications`**
   - For dedication notifications
   - Example: `category=dedications`

3. **`live_shows`**
   - For live show notifications
   - Example: `category=live_shows`

4. **`general`**
   - For general notifications
   - Example: `category=general`

---

## API Examples (using new keys)

### Get Templates by Category:

```http
# Video Calls
GET /api/admin/notifications/templates?category=video_calls&notificationType=push

# Dedications
GET /api/admin/notifications/templates?category=dedications&notificationType=push

# Live Shows
GET /api/admin/notifications/templates?category=live_shows&notificationType=push

# General
GET /api/admin/notifications/templates?category=general&notificationType=push

# All Categories (don't send category parameter)
GET /api/admin/notifications/templates?notificationType=push
```

---

## Important Notes:

1. **Case Sensitive:** Categories are case-sensitive. Use exact lowercase values:
   - ✅ `video_calls` (correct)
   - ❌ `Video_Calls` / `Video Calls` (wrong)

2. **Plural Forms:** Use plural forms:
   - ✅ `dedications` (correct)
   - ❌ `dedication` (wrong - singular)

3. **No spaces:** Always use snake_case (underscore) – no spaces.

4. **Invalid Categories:**
   - ❌ `Private Call` - NOT a valid category
   - ❌ `video_call` (singular) - use `video_calls`
   - ❌ `live_show` (singular) - use `live_shows`

---

## Frontend Implementation:

### Flutter/Dart Example:

```dart
// Category values as constants (new format)
const String CATEGORY_VIDEO_CALLS = 'video_calls';
const String CATEGORY_DEDICATIONS = 'dedications';
const String CATEGORY_LIVE_SHOWS = 'live_shows';
const String CATEGORY_GENERAL = 'general';

// Build URL with category
String buildTemplatesUrl(String category, String notificationType) {
  final encodedCategory = Uri.encodeComponent(category);
  return '$baseUrl/api/admin/notifications/templates?category=$encodedCategory&notificationType=$notificationType&page=1&limit=20';
}

// Usage
final url = buildTemplatesUrl(CATEGORY_LIVE_SHOWS, 'push');
```

---

## Service to Category Mapping:

When creating templates, `service` maps to `category`:

- `service: "Video Call"` → `category: "video_calls"`
- `service: "Dedication"` → `category: "dedications"`
- `service: "Live Show"` → `category: "live_shows"`
- `service: "General"` → `category: "general"`

---

**For any questions, refer to the NotificationTemplate model enum values.**
