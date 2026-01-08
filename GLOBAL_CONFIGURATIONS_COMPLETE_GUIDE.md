# Global Configurations Complete API Guide

## Overview
This is a comprehensive guide for all APIs used in the Global Configurations admin screen. This guide covers all sections visible in the UI.

**Base URL:** `/api/config/` or `/api/category/` or `/api/config/country-services`

**Authentication:** Most endpoints require admin authentication:
```
Authorization: Bearer <admin_token>
```

---

## Table of Contents

1. [Get Global Configuration](#1-get-global-configuration)
2. [Update Global Configuration](#2-update-global-configuration)
3. [Profession Management](#3-profession-management)
4. [Country Service Configuration](#4-country-service-configuration)
5. [Complete Screen Integration](#5-complete-screen-integration)

---

## 1. Get Global Configuration

**Endpoint:** `GET /api/config/`

**Description:** Retrieves all global configuration settings including service limits, fees, contact info, and hide settings

**Authentication:** Public (no auth required)

**Response:**
```json
{
  "success": true,
  "message": "Global configuration retrieved successfully",
  "data": {
    "config": {
      "id": "config_id",
      "liveShowPriceHide": false,
      "videoCallPriceHide": false,
      "becomeBaronistarPriceHide": false,
      "isTestUser": false,
      "hideApplyToBecomeStar": false,
      "serviceLimits": {
        "liveShowDuration": 20,
        "videoCallDuration": 5,
        "slotDuration": 10,
        "dedicationUploadSize": 20,
        "maxLiveShowParticipants": 10000,
        "reconnectionTimeout": 5
      },
      "idVerificationFees": {
        "standardIdPrice": 0,
        "goldIdPrice": 0
      },
      "liveShowFees": {
        "hostingFee": 0
      },
      "contactSupport": {
        "companyServiceNumber": "+34895723487",
        "supportEmail": "support@playform.com",
        "servicesTermsUrl": "https://help.platform.com",
        "privacyPolicyUrl": "https://help.platform.com",
        "helpdeskLink": "https://help.platform.com"
      },
      "hideElementsPrice": {
        "hideDedications": false
      },
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

---

## 2. Update Global Configuration

**Endpoint:** `PUT /api/config/` or `POST /api/config/`

**Description:** Updates global configuration settings. You can update any section or all sections at once.

**Authentication:** Admin required

### 2.1 Update Service Limits & Defaults

**Request Body:**
```json
{
  "serviceLimits": {
    "liveShowDuration": 16,
    "videoCallDuration": 16,
    "slotDuration": 16,
    "dedicationUploadSize": 16,
    "maxLiveShowParticipants": 10000,
    "reconnectionTimeout": 16
  }
}
```

**Example:**
```bash
PUT /api/config/
Headers: Authorization: Bearer <admin_token>
Body:
{
  "serviceLimits": {
    "liveShowDuration": 16,
    "videoCallDuration": 16,
    "slotDuration": 16,
    "dedicationUploadSize": 16,
    "maxLiveShowParticipants": 10000,
    "reconnectionTimeout": 16
  }
}
```

### 2.2 Update ID Verification Fees

**Request Body:**
```json
{
  "idVerificationFees": {
    "standardIdPrice": 10.99,
    "goldIdPrice": 25.99
  }
}
```

**Example:**
```bash
PUT /api/config/
Headers: Authorization: Bearer <admin_token>
Body:
{
  "idVerificationFees": {
    "standardIdPrice": 10.99,
    "goldIdPrice": 25.99
  }
}
```

### 2.3 Update Live Show Fees

**Request Body:**
```json
{
  "liveShowFees": {
    "hostingFee": 5.99
  }
}
```

### 2.4 Update Contact & Support Info

**Request Body:**
```json
{
  "contactSupport": {
    "companyServiceNumber": "+1234567890",
    "supportEmail": "support@baroni.com",
    "servicesTermsUrl": "https://baroni.com/terms",
    "privacyPolicyUrl": "https://baroni.com/privacy",
    "helpdeskLink": "https://baroni.com/help"
  }
}
```

### 2.5 Update Hide Elements Price

**Request Body:**
```json
{
  "hideElementsPrice": {
    "hideDedications": true
  },
  "liveShowPriceHide": true,
  "hideApplyToBecomeStar": true,
  "isTestUser": true
}
```

**Field Mapping:**
- `hideElementsPrice.hideDedications` → "Hide Dedications" toggle
- `liveShowPriceHide` → "Hide Live Show" toggle
- `hideApplyToBecomeStar` → "Hide Apply to Become Star" toggle
- `isTestUser` → "Test Users" toggle

**Example:**
```bash
PUT /api/config/
Headers: Authorization: Bearer <admin_token>
Body:
{
  "hideElementsPrice": {
    "hideDedications": true
  },
  "liveShowPriceHide": true,
  "hideApplyToBecomeStar": false,
  "isTestUser": true
}
```

### 2.6 Update All Settings at Once

**Request Body:**
```json
{
  "serviceLimits": {
    "liveShowDuration": 16,
    "videoCallDuration": 16,
    "slotDuration": 16,
    "dedicationUploadSize": 16,
    "maxLiveShowParticipants": 10000,
    "reconnectionTimeout": 16
  },
  "idVerificationFees": {
    "standardIdPrice": 10.99,
    "goldIdPrice": 25.99
  },
  "liveShowFees": {
    "hostingFee": 5.99
  },
  "contactSupport": {
    "companyServiceNumber": "+1234567890",
    "supportEmail": "support@baroni.com",
    "servicesTermsUrl": "https://baroni.com/terms",
    "privacyPolicyUrl": "https://baroni.com/privacy",
    "helpdeskLink": "https://baroni.com/help"
  },
  "hideElementsPrice": {
    "hideDedications": true
  },
  "liveShowPriceHide": true,
  "hideApplyToBecomeStar": false,
  "isTestUser": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Global configuration updated successfully",
  "data": {
    "config": {
      // Updated configuration object
    }
  }
}
```

---

## 3. Profession Management

### 3.1 Get All Professions

**Endpoint:** `GET /api/config/categories` (Public) or `GET /api/category/` (Auth required)

**Description:** Retrieves all professions (categories)

**Authentication:** Public for `/api/config/categories`, Required for `/api/category/`

**Response:**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": {
    "categories": [
      {
        "id": "category_id",
        "name": "Actor",
        "image": "https://res.cloudinary.com/.../actor.jpg",
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      },
      {
        "id": "category_id_2",
        "name": "Musician",
        "image": "https://res.cloudinary.com/.../musician.jpg",
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

### 3.2 Create Profession

**Endpoint:** `POST /api/category/`

**Description:** Creates a new profession

**Authentication:** Required

**Request (Form Data):**
```
name: "Actor"
image: [File] (JPEG, PNG, GIF)
```

**OR Request (JSON with URL):**
```json
{
  "name": "Actor",
  "image": "https://example.com/actor.jpg"
}
```

**Example:**
```bash
POST /api/category/
Headers: Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
Body (Form Data):
  name: "Actor"
  image: [file]
```

**Response:**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "category": {
      "id": "category_id",
      "name": "Actor",
      "image": "https://res.cloudinary.com/.../actor.jpg",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

### 3.3 Update Profession

**Endpoint:** `PUT /api/category/:id`

**Description:** Updates an existing profession (name and/or image)

**Authentication:** Required

**Request (Form Data):**
```
name: "Updated Actor Name" (optional)
image: [File] (optional)
```

**Example:**
```bash
PUT /api/category/category_id
Headers: Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
Body (Form Data):
  name: "Updated Actor Name"
  image: [file] (optional)
```

### 3.4 Delete Profession

**Endpoint:** `DELETE /api/category/:id`

**Description:** Deletes a profession

**Authentication:** Required

**Example:**
```bash
DELETE /api/category/category_id
Headers: Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

---

## 4. Country Service Configuration

### 4.1 Get All Country Service Configurations

**Endpoint:** `GET /api/config/country-services`

**Description:** Retrieves all country service configurations

**Authentication:** Public (no auth required)

**Query Parameters:**
- `isActive` (optional): Filter by active status (`true` or `false`)

**Response:**
```json
{
  "success": true,
  "message": "Country service configurations retrieved successfully",
  "data": {
    "countryConfigs": [
      {
        "id": "config_id",
        "country": "USA",
        "countryCode": "US",
        "services": {
          "videoCall": true,
          "dedication": false,
          "liveShow": true
        },
        "isActive": true,
        "sortOrder": 0,
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

### 4.2 Create Country Service Configuration

**Endpoint:** `POST /api/config/country-services`

**Description:** Creates a new country service configuration

**Authentication:** Admin required

**Request Body:**
```json
{
  "country": "USA",
  "countryCode": "US",
  "services": {
    "videoCall": true,
    "dedication": false,
    "liveShow": true
  },
  "sortOrder": 0
}
```

**Example:**
```bash
POST /api/config/country-services
Headers: 
  Authorization: Bearer <admin_token>
  Content-Type: application/json
Body:
{
  "country": "USA",
  "countryCode": "US",
  "services": {
    "videoCall": true,
    "dedication": false,
    "liveShow": true
  },
  "sortOrder": 0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Country service configuration created successfully",
  "data": {
    "countryConfig": {
      "id": "config_id",
      "country": "USA",
      "countryCode": "US",
      "services": {
        "videoCall": true,
        "dedication": false,
        "liveShow": true
      },
      "isActive": true,
      "sortOrder": 0,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

### 4.3 Update Country Service Configuration

**Endpoint:** `PUT /api/config/country-services/:configId`

**Description:** Updates an existing country service configuration

**Authentication:** Admin required

**Request Body:**
```json
{
  "country": "USA",
  "countryCode": "US",
  "services": {
    "videoCall": true,
    "dedication": true,
    "liveShow": false
  },
  "isActive": true,
  "sortOrder": 1
}
```

**Example:**
```bash
PUT /api/config/country-services/config_id
Headers: 
  Authorization: Bearer <admin_token>
  Content-Type: application/json
Body:
{
  "services": {
    "videoCall": true,
    "dedication": true,
    "liveShow": false
  }
}
```

### 4.4 Delete Country Service Configuration

**Endpoint:** `DELETE /api/config/country-services/:configId`

**Description:** Deletes a country service configuration

**Authentication:** Admin required

**Example:**
```bash
DELETE /api/config/country-services/config_id
Headers: Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Country service configuration deleted successfully"
}
```

---

## 5. Complete Screen Integration

### 5.1 Load All Data on Screen Load

```javascript
// Load all data when screen opens
const loadGlobalConfigurations = async () => {
  try {
    // 1. Get Global Configuration
    const configResponse = await fetch('/api/config/');
    const configData = await configResponse.json();
    const config = configData.data.config;
    
    // 2. Get Professions
    const professionsResponse = await fetch('/api/config/categories');
    const professionsData = await professionsResponse.json();
    const professions = professionsData.data.categories;
    
    // 3. Get Country Service Configurations
    const countriesResponse = await fetch('/api/config/country-services');
    const countriesData = await countriesResponse.json();
    const countries = countriesData.data.countryConfigs;
    
    return {
      config,
      professions,
      countries
    };
  } catch (error) {
    console.error('Error loading configurations:', error);
    throw error;
  }
};
```

### 5.2 Save All Changes

```javascript
// Save all changes when "Save Changes" button is clicked
const saveAllChanges = async (updatedConfig) => {
  try {
    const response = await fetch('/api/config/', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedConfig)
    });
    
    const data = await response.json();
    if (data.success) {
      return data.data.config;
    }
    throw new Error(data.message);
  } catch (error) {
    console.error('Error saving configuration:', error);
    throw error;
  }
};
```

### 5.3 Complete Example: Update Service Limits

```javascript
// Update Service Limits & Defaults section
const updateServiceLimits = async (limits) => {
  const response = await fetch('/api/config/', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      serviceLimits: {
        liveShowDuration: limits.maxLiveShowDuration,
        videoCallDuration: limits.maxVideoCallDuration,
        slotDuration: limits.defaultCallTime,
        dedicationUploadSize: limits.dedicationUploadSize,
        maxLiveShowParticipants: limits.maxLiveShowParticipants,
        reconnectionTimeout: limits.reconnectionTimeout
      }
    })
  });
  
  return await response.json();
};

// Usage
await updateServiceLimits({
  maxLiveShowDuration: 16,
  maxVideoCallDuration: 16,
  defaultCallTime: 16,
  dedicationUploadSize: 16,
  maxLiveShowParticipants: 10000,
  reconnectionTimeout: 16
});
```

### 5.4 Complete Example: Update Hide Settings

```javascript
// Update Hide Elements Price section
const updateHideSettings = async (hideSettings) => {
  const response = await fetch('/api/config/', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hideElementsPrice: {
        hideDedications: hideSettings.hideDedications
      },
      liveShowPriceHide: hideSettings.hideLiveShow,
      hideApplyToBecomeStar: hideSettings.hideApplyToBecomeStar,
      isTestUser: hideSettings.testUsers
    })
  });
  
  return await response.json();
};

// Usage
await updateHideSettings({
  hideDedications: true,
  hideLiveShow: true,
  hideApplyToBecomeStar: false,
  testUsers: true
});
```

### 5.5 Complete Example: Add Profession

```javascript
// Add new profession
const addProfession = async (name, imageFile) => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('image', imageFile);
  
  const response = await fetch('/api/category/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
      // Don't set Content-Type, browser will set it with boundary
    },
    body: formData
  });
  
  return await response.json();
};

// Usage
const fileInput = document.querySelector('input[type="file"]');
await addProfession('Actor', fileInput.files[0]);
```

### 5.6 Complete Example: Update Country Services

```javascript
// Update country service configuration
const updateCountryServices = async (configId, services) => {
  const response = await fetch(`/api/config/country-services/${configId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      services: {
        videoCall: services.videoCall,
        dedication: services.dedication,
        liveShow: services.liveShow
      }
    })
  });
  
  return await response.json();
};

// Usage
await updateCountryServices('config_id', {
  videoCall: true,
  dedication: false,
  liveShow: true
});
```

---

## Field Mapping Reference

### Service Limits & Defaults
- `serviceLimits.liveShowDuration` → "Max Live Show Duration" (minutes)
- `serviceLimits.videoCallDuration` → "Max Video call Duration" (minutes)
- `serviceLimits.slotDuration` → "Default Call Time" (minutes)
- `serviceLimits.dedicationUploadSize` → "Dedication Upload Size" (MB)
- `serviceLimits.maxLiveShowParticipants` → "Max Live Show Participants"
- `serviceLimits.reconnectionTimeout` → "Reconnection Timeout" (minutes)

### ID Verification Fees
- `idVerificationFees.standardIdPrice` → "Standard ID Price" ($)
- `idVerificationFees.goldIdPrice` → "Gold ID Price" ($)

### Live Show Fees
- `liveShowFees.hostingFee` → "Hosting Fee" ($)

### Contact & Support Info
- `contactSupport.companyServiceNumber` → "Company Service Number"
- `contactSupport.supportEmail` → "Support Email"
- `contactSupport.servicesTermsUrl` → "Services terms URL"
- `contactSupport.privacyPolicyUrl` → "Privacy Policy URL"
- `contactSupport.helpdeskLink` → "Helpdesk Link"

### Hide Elements Price
- `hideElementsPrice.hideDedications` → "Hide Dedications" toggle
- `liveShowPriceHide` → "Hide Live Show" toggle
- `hideApplyToBecomeStar` → "Hide Apply to Become Star" toggle
- `isTestUser` → "Test Users" toggle

---

## Validation Rules

### Service Limits
- `liveShowDuration`: 1-1440 minutes
- `videoCallDuration`: 1-1440 minutes
- `slotDuration`: 1-1440 minutes
- `dedicationUploadSize`: 1-1000 MB
- `maxLiveShowParticipants`: 1-100000
- `reconnectionTimeout`: 1-60 minutes

### Fees
- All fee values must be positive numbers (≥ 0)

### Contact Info
- `companyServiceNumber`: 5-20 characters
- `supportEmail`: Valid email format
- `servicesTermsUrl`: Valid URL
- `privacyPolicyUrl`: Valid URL
- `helpdeskLink`: Valid URL

### Profession
- `name`: Required, unique, 1-100 characters
- `image`: Required (file or URL)

### Country Service Config
- `country`: Required, unique, 2-100 characters
- `countryCode`: Required, unique, 2-3 uppercase letters
- `services`: Object with boolean values

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
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

### 409 Conflict
```json
{
  "success": false,
  "message": "Category name already exists"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Quick Reference

### Get All Data
```bash
# Global Config
GET /api/config/

# Professions
GET /api/config/categories

# Country Services
GET /api/config/country-services
```

### Update Global Config
```bash
PUT /api/config/
Headers: Authorization: Bearer <admin_token>
Body: { /* config object */ }
```

### Profession CRUD
```bash
# Create
POST /api/category/
Body: FormData (name, image)

# Update
PUT /api/category/:id
Body: FormData (name?, image?)

# Delete
DELETE /api/category/:id
```

### Country Service CRUD
```bash
# Create
POST /api/config/country-services
Body: { country, countryCode, services, sortOrder }

# Update
PUT /api/config/country-services/:configId
Body: { country?, countryCode?, services?, isActive?, sortOrder? }

# Delete
DELETE /api/config/country-services/:configId
```

---

## Testing Checklist

- [ ] Get global configuration returns all fields
- [ ] Update service limits works
- [ ] Update ID verification fees works
- [ ] Update live show fees works
- [ ] Update contact & support info works
- [ ] Update hide settings works (all toggles)
- [ ] Get professions returns list
- [ ] Create profession works (with image)
- [ ] Update profession works
- [ ] Delete profession works
- [ ] Get country services returns list
- [ ] Create country service works
- [ ] Update country service works (toggle services)
- [ ] Delete country service works
- [ ] Save all changes button works

---

## Support

For issues or questions, contact the development team.














