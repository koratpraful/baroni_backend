# Profession Management API Documentation

## Overview
This document describes the complete API system for managing Professions (Categories) in the Global Configurations admin panel. Professions are used to categorize stars in the system (e.g., Actor, Musician, Comedian).

**Base URL:** `/api/category`

**Authentication:** All endpoints require authentication token in header:
```
Authorization: Bearer <token>
```

**Note:** For admin-only access, ensure the user has `admin` role.

---

## API Endpoints

### 1. Get All Professions

**Endpoint:** `GET /api/category/`

**Description:** Retrieves a list of all professions (categories) in the system.

**Authentication:** Required

**Request:**
```http
GET /api/category/
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Actor",
      "image": "https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/actor.jpg",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "65a1b2c3d4e5f6g7h8i9j0k2",
      "name": "Musician",
      "image": "https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/musician.jpg",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "65a1b2c3d4e5f6g7h8i9j0k3",
      "name": "Comedian",
      "image": "https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/comedian.jpg",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

### 2. Get Single Profession

**Endpoint:** `GET /api/category/:id`

**Description:** Retrieves details of a specific profession by ID.

**Authentication:** Required

**Path Parameters:**
- `id` (required): The profession ID (MongoDB ObjectId)

**Request:**
```http
GET /api/category/65a1b2c3d4e5f6g7h8i9j0k1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": {
    "category": {
      "id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Actor",
      "image": "https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/actor.jpg",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

**Error Responses:**

**404 - Not Found:**
```json
{
  "success": false,
  "message": "Category not found"
}
```

**400 - Invalid ID:**
```json
{
  "success": false,
  "message": "Invalid category ID"
}
```

---

### 3. Create Profession

**Endpoint:** `POST /api/category/`

**Description:** Creates a new profession (category) in the system.

**Authentication:** Required (Admin recommended)

**Request:**
```http
POST /api/category/
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `name` (required, string): The name of the profession (e.g., "Actor", "Musician")
- `image` (required, file): Image file for the profession (JPEG, PNG, GIF)
  - OR `image` (optional, string): Direct image URL if uploading separately

**Example using FormData:**
```javascript
const formData = new FormData();
formData.append('name', 'Actor');
formData.append('image', imageFile); // File object
```

**Example using JSON (with image URL):**
```json
{
  "name": "Actor",
  "image": "https://example.com/actor.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "category": {
      "id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Actor",
      "image": "https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/actor.jpg",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "Name is required"
}
```

**400 - Image Required:**
```json
{
  "success": false,
  "message": "Image is required"
}
```

**409 - Duplicate Name:**
```json
{
  "success": false,
  "message": "Category name already exists"
}
```

**500 - Server Error:**
```json
{
  "success": false,
  "message": "Failed to create category"
}
```

---

### 4. Update Profession

**Endpoint:** `PUT /api/category/:id`

**Description:** Updates an existing profession (name and/or image).

**Authentication:** Required (Admin recommended)

**Path Parameters:**
- `id` (required): The profession ID (MongoDB ObjectId)

**Request:**
```http
PUT /api/category/65a1b2c3d4e5f6g7h8i9j0k1
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `name` (optional, string): Updated name of the profession
- `image` (optional, file): New image file for the profession
  - OR `image` (optional, string): Direct image URL

**Example using FormData:**
```javascript
const formData = new FormData();
formData.append('name', 'Updated Actor Name');
formData.append('image', imageFile); // Optional: new image file
```

**Example using JSON (with image URL):**
```json
{
  "name": "Updated Actor Name",
  "image": "https://example.com/new-actor.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "category": {
      "id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "Updated Actor Name",
      "image": "https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/new-actor.jpg",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-16T14:30:00.000Z"
    }
  }
}
```

**Error Responses:**

**404 - Not Found:**
```json
{
  "success": false,
  "message": "Category not found"
}
```

**409 - Duplicate Name:**
```json
{
  "success": false,
  "message": "Category name already exists"
}
```

**400 - Invalid ID:**
```json
{
  "success": false,
  "message": "Invalid category ID"
}
```

---

### 5. Delete Profession

**Endpoint:** `DELETE /api/category/:id`

**Description:** Deletes a profession (category) from the system.

**Authentication:** Required (Admin recommended)

**Path Parameters:**
- `id` (required): The profession ID (MongoDB ObjectId)

**Request:**
```http
DELETE /api/category/65a1b2c3d4e5f6g7h8i9j0k1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

**Error Responses:**

**404 - Not Found:**
```json
{
  "success": false,
  "message": "Category not found"
}
```

**400 - Invalid ID:**
```json
{
  "success": false,
  "message": "Invalid category ID"
}
```

**500 - Server Error:**
```json
{
  "success": false,
  "message": "Failed to delete category"
}
```

---

## Alternative Public Endpoint

### Get All Professions (Public)

**Endpoint:** `GET /api/config/categories`

**Description:** Public endpoint to retrieve all professions without authentication. Useful for displaying professions in public-facing screens.

**Authentication:** Not required

**Request:**
```http
GET /api/config/categories
```

**Response:**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": {
    "categories": [
      {
        "id": "65a1b2c3d4e5f6g7h8i9j0k1",
        "name": "Actor",
        "image": "https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/actor.jpg",
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

---

## Data Models

### Profession Object
```typescript
interface Profession {
  id: string;              // MongoDB ObjectId
  name: string;            // Profession name (unique)
  image: string;           // Image URL (Cloudinary)
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;       // ISO 8601 timestamp
}
```

---

## Frontend Integration Examples

### React/Next.js Example

#### 1. Get All Professions
```javascript
const getProfessions = async () => {
  try {
    const response = await fetch('/api/category/', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (data.success) {
      return data.data; // Array of professions
    }
    throw new Error(data.message);
  } catch (error) {
    console.error('Error fetching professions:', error);
    throw error;
  }
};
```

#### 2. Create Profession
```javascript
const createProfession = async (name, imageFile) => {
  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('image', imageFile);

    const response = await fetch('/api/category/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Don't set Content-Type header, browser will set it with boundary
      },
      body: formData
    });
    
    const data = await response.json();
    if (data.success) {
      return data.data.category;
    }
    throw new Error(data.message);
  } catch (error) {
    console.error('Error creating profession:', error);
    throw error;
  }
};
```

#### 3. Update Profession
```javascript
const updateProfession = async (id, name, imageFile) => {
  try {
    const formData = new FormData();
    if (name) formData.append('name', name);
    if (imageFile) formData.append('image', imageFile);

    const response = await fetch(`/api/category/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    if (data.success) {
      return data.data.category;
    }
    throw new Error(data.message);
  } catch (error) {
    console.error('Error updating profession:', error);
    throw error;
  }
};
```

#### 4. Delete Profession
```javascript
const deleteProfession = async (id) => {
  try {
    const response = await fetch(`/api/category/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    if (data.success) {
      return true;
    }
    throw new Error(data.message);
  } catch (error) {
    console.error('Error deleting profession:', error);
    throw error;
  }
};
```

---

## Validation Rules

### Name Validation
- **Required:** Yes (for create)
- **Type:** String
- **Min Length:** 1 character
- **Max Length:** 100 characters (recommended)
- **Unique:** Yes (profession names must be unique)
- **Trimmed:** Yes (leading/trailing whitespace removed)

### Image Validation
- **Required:** Yes (for create)
- **Type:** File (multipart/form-data) or String (URL)
- **Supported Formats:** JPEG, JPG, PNG, GIF
- **Max Size:** 5MB (check with backend)
- **Upload:** Images are uploaded to Cloudinary

---

## Error Handling

### Common Error Codes

| Status Code | Description | Solution |
|------------|------------|----------|
| 400 | Bad Request | Check request body/parameters |
| 401 | Unauthorized | Check authentication token |
| 403 | Forbidden | User doesn't have required permissions |
| 404 | Not Found | Profession ID doesn't exist |
| 409 | Conflict | Profession name already exists |
| 500 | Server Error | Contact backend team |

### Error Response Format
```json
{
  "success": false,
  "message": "Error message describing what went wrong"
}
```

---

## Best Practices

1. **Image Upload:**
   - Compress images before uploading to reduce file size
   - Use appropriate image dimensions (recommended: 200x200px or 400x400px)
   - Validate file type on frontend before upload

2. **Name Validation:**
   - Trim whitespace before sending
   - Check for duplicate names before submitting
   - Display user-friendly error messages

3. **Error Handling:**
   - Always check `success` field in response
   - Display user-friendly error messages
   - Handle network errors gracefully

4. **Loading States:**
   - Show loading indicators during API calls
   - Disable form buttons during submission
   - Provide feedback on success/failure

5. **Caching:**
   - Cache profession list to reduce API calls
   - Refresh cache after create/update/delete operations

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Image URLs are from Cloudinary CDN
- Profession names are case-sensitive for uniqueness
- Deleting a profession may affect stars assigned to it (check with backend for cascade behavior)
- For admin-only operations, ensure user has `admin` role before making requests

---

## Support

For any questions or issues, contact the backend development team.

