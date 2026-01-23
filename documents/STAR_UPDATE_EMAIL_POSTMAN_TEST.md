# Star Profile Update API - Postman Test Guide

## 📍 API Endpoint

**Method:** `PUT`  
**URL:** `http://34.142.84.222:4000/api/admin/management/stars/:starId`

**Replace `:starId` with actual star ID**

---

## 🔐 Authentication

**Header Required:**
```
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json
```

---

## 📝 Request Body Examples

### Example 1: Update Email Only

```json
{
  "email": "newemail@example.com"
}
```

### Example 2: Update Email + Other Fields

```json
{
  "email": "newemail@example.com",
  "name": "Updated Name",
  "pseudo": "updated_pseudo",
  "contact": "+917201940694",
  "country": "भारत"
}
```

### Example 3: Update Email + Services

```json
{
  "email": "newemail@example.com",
  "services": [
    {
      "type": "Video call",
      "price": "105"
    },
    {
      "type": "Wedding",
      "price": "108"
    },
    {
      "type": "Birthday",
      "price": "105"
    }
  ]
}
```

### Example 4: Complete Update (Email + Profile + Services)

```json
{
  "email": "star@example.com",
  "name": "Star Name",
  "pseudo": "star_pseudo",
  "contact": "+917201940694",
  "country": "भारत",
  "profession": "68d3c726016405cc0cf6cfed",
  "about": "This is a detailed about section that must be at least 100 characters long to meet the validation requirements for star profiles.",
  "availableForBookings": true,
  "hidden": false,
  "isVerified": true,
  "feature_star": true,
  "services": [
    {
      "type": "Video call",
      "price": "105"
    },
    {
      "type": "Wedding",
      "price": "108"
    }
  ]
}
```

---

## 🧪 Postman Setup

### Step 1: Create New Request
1. Open Postman
2. Click "New" → "HTTP Request"
3. Set method to **PUT**

### Step 2: Set URL
```
http://34.142.84.222:4000/api/admin/management/stars/YOUR_STAR_ID
```

**Replace `YOUR_STAR_ID` with actual star ID (e.g., `6927e2a27c7ff6ccbbbe7b58`)**

### Step 3: Set Headers
Go to **Headers** tab and add:

| Key | Value |
|-----|-------|
| `Authorization` | `Bearer YOUR_ADMIN_TOKEN` |
| `Content-Type` | `application/json` |

### Step 4: Set Body
1. Go to **Body** tab
2. Select **raw**
3. Select **JSON** from dropdown
4. Paste one of the JSON examples above

### Step 5: Send Request
Click **Send** button

---

## ✅ Expected Success Response

```json
{
  "success": true,
  "message": "Star profile updated successfully",
  "data": {
    "star": {
      "id": "6927e2a27c7ff6ccbbbe7b58",
      "baroniId": "35946",
      "name": "Updated Name",
      "pseudo": "updated_pseudo",
      "email": "newemail@example.com",
      "contact": "+917201940694",
      "profilePic": "https://...",
      "country": "भारत",
      "countryFlag": "🇮🇳",
      "profession": {
        "id": "68d3c726016405cc0cf6cfed",
        "name": "Influencer"
      },
      "about": "...",
      "location": null,
      "preferredLanguage": "English",
      "availableForBookings": true,
      "hidden": false,
      "appNotification": true,
      "role": "star",
      "isVerified": true,
      "feature_star": true,
      "introVideo": null,
      "status": "active",
      "createdAt": "2025-11-27T05:33:22.721Z",
      "lastLoginAt": "2026-01-12T16:27:07.959Z"
    }
  }
}
```

---

## ❌ Error Responses

### 1. Invalid Star ID
```json
{
  "success": false,
  "message": "Invalid star ID"
}
```
**Status Code:** `400`

### 2. Star Not Found
```json
{
  "success": false,
  "message": "User not found"
}
```
**Status Code:** `404`

### 3. Email Already in Use
```json
{
  "success": false,
  "message": "Email already in use"
}
```
**Status Code:** `409`

### 4. Invalid Email Format
```json
{
  "success": false,
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```
**Status Code:** `400`

### 5. Unauthorized (No Admin Token)
```json
{
  "success": false,
  "message": "Admin access required"
}
```
**Status Code:** `403`

---

## 🔍 Testing Checklist

- [ ] Test with valid star ID
- [ ] Test with invalid star ID
- [ ] Test email update only
- [ ] Test email + other fields
- [ ] Test email + services
- [ ] Test with duplicate email (should fail)
- [ ] Test with invalid email format (should fail)
- [ ] Test without admin token (should fail)
- [ ] Verify email is actually updated in database

---

## 📋 Allowed Fields

You can update any of these fields (all optional):

- `name` - String (1-100 chars)
- `pseudo` - String (1-50 chars)
- `email` - Valid email address
- `contact` - String (max 20 chars)
- `profilePic` - Valid URL or empty string
- `country` - String (max 50 chars)
- `profession` - MongoDB ObjectId
- `category` - MongoDB ObjectId (same as profession)
- `about` - String (min 100 chars if provided)
- `location` - String
- `preferredLanguage` - String
- `availableForBookings` - Boolean
- `hidden` - Boolean
- `appNotification` - Boolean
- `role` - "star" or "fan"
- `isVerified` - Boolean
- `introVideo` - Valid URL or empty string
- `status` - "active" or "blocked" or "inactive"
- `feature_star` - Boolean
- `services` - Array of objects with `type` and `price`

---

## 🐛 Troubleshooting

### Issue: Email not updating
**Check:**
1. Is email field in request body?
2. Is email format valid?
3. Is email different from current email?
4. Is email already used by another user?
5. Check server logs for errors

### Issue: 403 Forbidden
**Solution:**
- Make sure you have valid admin token
- Token should be in format: `Bearer YOUR_TOKEN`
- Token should not be expired

### Issue: 404 Not Found
**Solution:**
- Verify star ID is correct
- Check if star exists in database
- Make sure star ID is valid MongoDB ObjectId

### Issue: Services not updating
**Solution:**
- Make sure `services` is an array
- Each service should have `type` and `price`
- Price should be a valid number (can be string)

---

## 📞 Quick Test Command (cURL)

```bash
curl --location --request PUT 'http://34.142.84.222:4000/api/admin/management/stars/YOUR_STAR_ID' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "newemail@example.com"
}'
```

---

**Note:** Replace `YOUR_STAR_ID` and `YOUR_ADMIN_TOKEN` with actual values.
