# Baroni Backend API Endpoints Mapping

This document provides a comprehensive mapping of all API endpoints and their corresponding files.

## Base URL Structure

- **Base URL**: `http://localhost:4000`
- **API Base**: `http://localhost:4000/api`

---

## 🔐 Authentication Endpoints

**Route**: `/api/auth`  
**File**: `routes/api/auth.js`  
**Controller**: `controllers/auth.js`

| Method | Endpoint                           | Description              | Auth Required |
| ------ | ---------------------------------- | ------------------------ | ------------- |
| POST   | `/api/auth/register`               | User registration        | ❌            |
| POST   | `/api/auth/login`                  | User login               | ❌            |
| POST   | `/api/auth/refresh`                | Refresh auth token       | ❌            |
| GET    | `/api/auth/me`                     | Get current user profile | ✅            |
| PUT    | `/api/auth/complete-profile`       | Complete user profile    | ✅            |
| POST   | `/api/auth/forgot-password`        | Forgot password          | ❌            |
| POST   | `/api/auth/reset-password`         | Reset password           | ❌            |
| POST   | `/api/auth/check-user`             | Check if user exists     | ❌            |
| DELETE | `/api/auth/soft-delete`            | Soft delete account      | ✅            |
| POST   | `/api/auth/send-otp`               | Send OTP                 | ❌            |
| POST   | `/api/auth/verify-otp`             | Verify OTP               | ❌            |
| POST   | `/api/auth/logout`                 | Logout user              | ✅            |
| PUT    | `/api/auth/fcm-token`              | Update FCM token         | ✅            |
| PUT    | `/api/auth/apns-token`             | Update APNS token        | ✅            |
| PUT    | `/api/auth/voip-token`             | Update VoIP token        | ✅            |
| PUT    | `/api/auth/device-type`            | Update device type       | ✅            |
| PUT    | `/api/auth/available-for-bookings` | Toggle availability      | ✅            |
| GET    | `/api/auth/google`                 | Google OAuth             | ❌            |
| GET    | `/api/auth/google/callback`        | Google OAuth callback    | ❌            |
| GET    | `/api/auth/apple`                  | Apple OAuth              | ❌            |
| GET    | `/api/auth/apple/callback`         | Apple OAuth callback     | ❌            |

---

## 🌟 Stars Endpoints

**Route**: `/api/star`  
**File**: `routes/api/star.js`  
**Controller**: `controllers/star.js`

| Method | Endpoint           | Description      | Auth Required |
| ------ | ------------------ | ---------------- | ------------- |
| GET    | `/api/star`        | Get all stars    | ❌            |
| GET    | `/api/star/search` | Search stars     | ❌            |
| GET    | `/api/star/:id`    | Get star profile | ❌            |

---

## 📂 Categories Endpoints

**Route**: `/api/category`  
**File**: `routes/api/category.js`  
**Controller**: `controllers/category.js`

| Method | Endpoint            | Description        | Auth Required |
| ------ | ------------------- | ------------------ | ------------- |
| GET    | `/api/category`     | Get all categories | ❌            |
| GET    | `/api/category/:id` | Get category by ID | ❌            |
| POST   | `/api/category`     | Create category    | ✅ (Admin)    |
| PUT    | `/api/category/:id` | Update category    | ✅ (Admin)    |
| DELETE | `/api/category/:id` | Delete category    | ✅ (Admin)    |

---

## 📊 Dashboard Endpoints

**Route**: `/api/dashboard`  
**File**: `routes/api/dashboard.js`  
**Controller**: `controllers/dashboard.js`

| Method | Endpoint                              | Description          | Auth Required |
| ------ | ------------------------------------- | -------------------- | ------------- |
| GET    | `/api/dashboard`                      | Get user dashboard   | ✅            |
| GET    | `/api/dashboard/debug-featured-stars` | Debug featured stars | ❌            |

---

## 💝 Dedications Endpoints

**Route**: `/api/dedications`  
**File**: `routes/api/dedications.js`  
**Controller**: `controllers/dedication.js`

| Method | Endpoint               | Description          | Auth Required |
| ------ | ---------------------- | -------------------- | ------------- |
| GET    | `/api/dedications`     | Get dedications      | ❌            |
| GET    | `/api/dedications/:id` | Get dedication by ID | ❌            |
| POST   | `/api/dedications`     | Create dedication    | ✅ (Star)     |
| PUT    | `/api/dedications/:id` | Update dedication    | ✅ (Star)     |
| DELETE | `/api/dedications/:id` | Delete dedication    | ✅ (Star)     |

---

## 📝 Dedication Requests Endpoints

**Route**: `/api/dedication-requests`  
**File**: `routes/api/dedicationRequests.js`  
**Controller**: `controllers/dedicationRequest.js`

| Method | Endpoint                       | Description             | Auth Required |
| ------ | ------------------------------ | ----------------------- | ------------- |
| GET    | `/api/dedication-requests`     | Get dedication requests | ✅            |
| GET    | `/api/dedication-requests/:id` | Get request by ID       | ✅            |
| POST   | `/api/dedication-requests`     | Create request          | ✅ (Fan)      |
| PUT    | `/api/dedication-requests/:id` | Update request          | ✅            |
| DELETE | `/api/dedication-requests/:id` | Delete request          | ✅            |

---

## 🎯 Services Endpoints

**Route**: `/api/services`  
**File**: `routes/api/services.js`  
**Controller**: `controllers/service.js`

| Method | Endpoint            | Description       | Auth Required |
| ------ | ------------------- | ----------------- | ------------- |
| GET    | `/api/services`     | Get services      | ❌            |
| GET    | `/api/services/:id` | Get service by ID | ❌            |
| POST   | `/api/services`     | Create service    | ✅ (Star)     |
| PUT    | `/api/services/:id` | Update service    | ✅ (Star)     |
| DELETE | `/api/services/:id` | Delete service    | ✅ (Star)     |

---

## 🎬 Dedication Samples Endpoints

**Route**: `/api/dedication-samples`  
**File**: `routes/api/dedicationSamples.js`  
**Controller**: `controllers/dedicationSample.js`

| Method | Endpoint                      | Description      | Auth Required |
| ------ | ----------------------------- | ---------------- | ------------- |
| GET    | `/api/dedication-samples`     | Get samples      | ❌            |
| GET    | `/api/dedication-samples/:id` | Get sample by ID | ❌            |
| POST   | `/api/dedication-samples`     | Create sample    | ✅ (Star)     |
| PUT    | `/api/dedication-samples/:id` | Update sample    | ✅ (Star)     |
| DELETE | `/api/dedication-samples/:id` | Delete sample    | ✅ (Star)     |

---

## 📅 Availability Endpoints

**Route**: `/api/availabilities`  
**File**: `routes/api/availabilities.js`  
**Controller**: `controllers/availability.js`

| Method | Endpoint                                | Description              | Auth Required |
| ------ | --------------------------------------- | ------------------------ | ------------- |
| GET    | `/api/availabilities`                   | Get my availabilities    | ✅            |
| GET    | `/api/availabilities/:id`               | Get availability by ID   | ✅            |
| POST   | `/api/availabilities`                   | Create availability      | ✅            |
| PUT    | `/api/availabilities/:id`               | Update availability      | ✅            |
| DELETE | `/api/availabilities/:id`               | Delete availability      | ✅            |
| DELETE | `/api/availabilities/slot`              | Delete time slot by date | ✅            |
| DELETE | `/api/availabilities/:id/slots/:slotId` | Delete time slot by ID   | ✅            |

---

## 📝 Appointments Endpoints

**Route**: `/api/appointments`  
**File**: `routes/api/appointments.js`  
**Controller**: `controllers/appointment.js`

| Method | Endpoint                        | Description           | Auth Required |
| ------ | ------------------------------- | --------------------- | ------------- |
| GET    | `/api/appointments`             | Get appointments      | ✅            |
| GET    | `/api/appointments/:id`         | Get appointment by ID | ✅            |
| POST   | `/api/appointments`             | Create appointment    | ✅ (Fan)      |
| PUT    | `/api/appointments/:id`         | Update appointment    | ✅            |
| DELETE | `/api/appointments/:id`         | Cancel appointment    | ✅            |
| PUT    | `/api/appointments/:id/approve` | Approve appointment   | ✅ (Star)     |
| PUT    | `/api/appointments/:id/reject`  | Reject appointment    | ✅ (Star)     |

---

## 💰 Transactions Endpoints

**Route**: `/api/transactions`  
**File**: `routes/api/transactions.js`  
**Controller**: `controllers/transaction.js`

| Method | Endpoint                           | Description      | Auth Required |
| ------ | ---------------------------------- | ---------------- | ------------- |
| POST   | `/api/transactions/purchase-coins` | Purchase coins   | ✅            |
| POST   | `/api/transactions/transfer`       | Transfer coins   | ✅            |
| GET    | `/api/transactions`                | Get transactions | ✅            |
| GET    | `/api/transactions/balance`        | Get coin balance | ✅            |
| GET    | `/api/transactions/earnings`       | Get earnings     | ✅            |

---

## 💳 Payment Callback Endpoints

**Route**: `/api/payment`  
**File**: `routes/api/paymentCallback.js`  
**Controller**: `controllers/paymentCallback.js`

| Method | Endpoint                | Description      | Auth Required |
| ------ | ----------------------- | ---------------- | ------------- |
| POST   | `/api/payment/callback` | Payment callback | ❌            |
| POST   | `/api/payment/webhook`  | Payment webhook  | ❌            |

---

## ❤️ Favorites Endpoints

**Route**: `/api/favorites`  
**File**: `routes/api/favorites.js`  
**Controller**: `controllers/favorites.js`

| Method | Endpoint                 | Description           | Auth Required |
| ------ | ------------------------ | --------------------- | ------------- |
| GET    | `/api/favorites`         | Get user favorites    | ✅            |
| POST   | `/api/favorites`         | Add to favorites      | ✅            |
| DELETE | `/api/favorites/:starId` | Remove from favorites | ✅            |

---

## 🎥 Live Shows Endpoints

**Route**: `/api/live-shows`  
**File**: `routes/api/liveShows.js`  
**Controller**: `controllers/liveShow.js`

| Method | Endpoint                    | Description         | Auth Required |
| ------ | --------------------------- | ------------------- | ------------- |
| GET    | `/api/live-shows`           | Get live shows      | ❌            |
| GET    | `/api/live-shows/:id`       | Get live show by ID | ❌            |
| POST   | `/api/live-shows`           | Create live show    | ✅ (Star)     |
| PUT    | `/api/live-shows/:id`       | Update live show    | ✅ (Star)     |
| DELETE | `/api/live-shows/:id`       | Delete live show    | ✅ (Star)     |
| POST   | `/api/live-shows/:id/join`  | Join live show      | ✅ (Fan)      |
| POST   | `/api/live-shows/:id/leave` | Leave live show     | ✅            |
| POST   | `/api/live-shows/:id/like`  | Like live show      | ✅            |
| DELETE | `/api/live-shows/:id/like`  | Unlike live show    | ✅            |

---

## 🚨 Report Users Endpoints

**Route**: `/api/report-users`  
**File**: `routes/api/reportUsers.js`  
**Controller**: `controllers/reportUser.js`

| Method | Endpoint                | Description   | Auth Required |
| ------ | ----------------------- | ------------- | ------------- |
| GET    | `/api/report-users`     | Get reports   | ✅ (Admin)    |
| POST   | `/api/report-users`     | Report user   | ✅            |
| PUT    | `/api/report-users/:id` | Update report | ✅ (Admin)    |

---

## 💬 Messaging Endpoints

**Route**: `/api/messages`  
**File**: `routes/api/messaging.js`  
**Controller**: `controllers/messages.js`

| Method | Endpoint                      | Description       | Auth Required |
| ------ | ----------------------------- | ----------------- | ------------- |
| GET    | `/api/messages`               | Get messages      | ✅            |
| GET    | `/api/messages/conversations` | Get conversations | ✅            |
| POST   | `/api/messages/send`          | Send message      | ✅            |
| PUT    | `/api/messages/:id/read`      | Mark as read      | ✅            |

---

## 🎤 Agora (Video/Audio) Endpoints

**Route**: `/api/agora`  
**File**: `routes/api/agora.js`  
**Controller**: `controllers/agora.js`

| Method | Endpoint               | Description     | Auth Required |
| ------ | ---------------------- | --------------- | ------------- |
| POST   | `/api/agora/token`     | Get Agora token | ✅            |
| POST   | `/api/agora/rtm-token` | Get RTM token   | ✅            |

---

## 🔔 Notifications Endpoints

**Route**: `/api/notifications`  
**File**: `routes/api/notifications.js`  
**Controller**: `controllers/notification.js`

| Method | Endpoint                        | Description         | Auth Required |
| ------ | ------------------------------- | ------------------- | ------------- |
| GET    | `/api/notifications`            | Get notifications   | ✅            |
| POST   | `/api/notifications`            | Create notification | ✅ (Admin)    |
| PUT    | `/api/notifications/:id/read`   | Mark as read        | ✅            |
| DELETE | `/api/notifications/:id`        | Delete notification | ✅            |
| PATCH  | `/api/notifications/fcm-token`  | Update FCM token    | ✅            |
| PATCH  | `/api/notifications/apns-token` | Update APNS token   | ✅            |

---

## ⭐ Ratings & Reviews Endpoints

**Route**: `/api/ratings`  
**File**: `routes/api/ratings.js`  
**Controller**: `controllers/rating.js`

| Method | Endpoint                    | Description      | Auth Required |
| ------ | --------------------------- | ---------------- | ------------- |
| POST   | `/api/ratings/appointment`  | Rate appointment | ✅ (Fan)      |
| POST   | `/api/ratings/dedication`   | Rate dedication  | ✅ (Fan)      |
| POST   | `/api/ratings/live-show`    | Rate live show   | ✅ (Fan)      |
| GET    | `/api/ratings/star/:starId` | Get star reviews | ❌            |
| GET    | `/api/ratings`              | Get my reviews   | ✅            |
| PUT    | `/api/ratings/:reviewId`    | Update review    | ✅            |
| DELETE | `/api/ratings/:reviewId`    | Delete review    | ✅            |

---

## 📈 Analytics Endpoints

**Route**: `/api/analytics`  
**File**: `routes/api/analytics.js`  
**Controller**: `controllers/analytics.js`

| Method | Endpoint                   | Description       | Auth Required |
| ------ | -------------------------- | ----------------- | ------------- |
| GET    | `/api/analytics/dashboard` | Get analytics     | ✅ (Admin)    |
| GET    | `/api/analytics/users`     | User analytics    | ✅ (Admin)    |
| GET    | `/api/analytics/revenue`   | Revenue analytics | ✅ (Admin)    |

---

## ⚙️ Configuration Endpoints

**Route**: `/api/config`  
**File**: `routes/api/config.js`  
**Controller**: `controllers/config.js`

| Method | Endpoint      | Description    | Auth Required |
| ------ | ------------- | -------------- | ------------- |
| GET    | `/api/config` | Get app config | ❌            |
| PUT    | `/api/config` | Update config  | ✅ (Admin)    |

---

## 📞 Contact Support Endpoints

**Route**: `/api/contact-support`  
**File**: `routes/api/contactSupport.js`  
**Controller**: `controllers/contactSupport.js`

| Method | Endpoint                   | Description           | Auth Required |
| ------ | -------------------------- | --------------------- | ------------- |
| GET    | `/api/contact-support`     | Get support tickets   | ✅            |
| POST   | `/api/contact-support`     | Create support ticket | ✅            |
| PUT    | `/api/contact-support/:id` | Update ticket         | ✅            |

---

## 🎪 Events Endpoints

**Route**: `/api/events`  
**File**: `routes/api/events.js`  
**Controller**: `controllers/event.js` (if exists)

| Method | Endpoint      | Description  | Auth Required |
| ------ | ------------- | ------------ | ------------- |
| GET    | `/api/events` | Get events   | ❌            |
| POST   | `/api/events` | Create event | ✅            |

---

## 📢 Ads Management Endpoints

**Route**: `/api/ads`  
**File**: `routes/api/ads.js`  
**Controller**: `controllers/ads.js`

| Method | Endpoint       | Description | Auth Required |
| ------ | -------------- | ----------- | ------------- |
| GET    | `/api/ads`     | Get ads     | ❌            |
| POST   | `/api/ads`     | Create ad   | ✅ (Admin)    |
| PUT    | `/api/ads/:id` | Update ad   | ✅ (Admin)    |
| DELETE | `/api/ads/:id` | Delete ad   | ✅ (Admin)    |

---

## 👑 Admin Endpoints

**Route**: `/api/admin`  
**File**: `routes/api/admin.js`  
**Controller**: `controllers/admin.js`

| Method | Endpoint                       | Description   | Auth Required |
| ------ | ------------------------------ | ------------- | ------------- |
| GET    | `/api/admin/users`             | Get all users | ✅ (Admin)    |
| PUT    | `/api/admin/users/:id`         | Update user   | ✅ (Admin)    |
| DELETE | `/api/admin/users/:id`         | Delete user   | ✅ (Admin)    |
| PUT    | `/api/admin/users/:id/feature` | Feature user  | ✅ (Admin)    |
| PUT    | `/api/admin/users/:id/ban`     | Ban user      | ✅ (Admin)    |

---

## 📊 Admin Dashboard Endpoints

**Route**: `/api/admin/dashboard`  
**File**: `routes/api/adminDashboard.js`  
**Controller**: `controllers/adminDashboard.js`

| Method | Endpoint                     | Description     | Auth Required |
| ------ | ---------------------------- | --------------- | ------------- |
| GET    | `/api/admin/dashboard`       | Admin dashboard | ✅ (Admin)    |
| GET    | `/api/admin/dashboard/stats` | Dashboard stats | ✅ (Admin)    |

---

## 🛠️ Admin Management Endpoints

**Route**: `/api/admin/management`  
**File**: `routes/api/adminManagement.js`  
**Controller**: `controllers/adminManagement.js` (if exists)

| Method | Endpoint                        | Description    | Auth Required |
| ------ | ------------------------------- | -------------- | ------------- |
| GET    | `/api/admin/management/users`   | Manage users   | ✅ (Admin)    |
| GET    | `/api/admin/management/stars`   | Manage stars   | ✅ (Admin)    |
| GET    | `/api/admin/management/reports` | Manage reports | ✅ (Admin)    |

---

## ⭐ Admin Rating Management Endpoints

**Route**: `/api/admin/rating-management`  
**File**: `routes/api/adminRatingManagement.js`  
**Controller**: `controllers/adminRatingManagement.js`

| Method | Endpoint                                   | Description    | Auth Required |
| ------ | ------------------------------------------ | -------------- | ------------- |
| GET    | `/api/admin/rating-management/reviews`     | Manage reviews | ✅ (Admin)    |
| PUT    | `/api/admin/rating-management/reviews/:id` | Update review  | ✅ (Admin)    |
| DELETE | `/api/admin/rating-management/reviews/:id` | Delete review  | ✅ (Admin)    |

---

## 🎧 Support Manager Endpoints

**Route**: `/api/support-manager`  
**File**: `routes/api/supportManager.js`  
**Controller**: `controllers/supportManager.js`

| Method | Endpoint                                 | Description         | Auth Required |
| ------ | ---------------------------------------- | ------------------- | ------------- |
| GET    | `/api/support-manager/tickets`           | Get support tickets | ✅ (Support)  |
| PUT    | `/api/support-manager/tickets/:id`       | Update ticket       | ✅ (Support)  |
| POST   | `/api/support-manager/tickets/:id/reply` | Reply to ticket     | ✅ (Support)  |

---

## 📁 File Structure Summary

### Route Files (routes/api/):

- `auth.js` - Authentication & user management
- `star.js` - Star profiles and search
- `category.js` - Categories management
- `dashboard.js` - User dashboards
- `dedications.js` - Dedication services
- `dedicationRequests.js` - Dedication requests
- `services.js` - Star services
- `dedicationSamples.js` - Sample content
- `availabilities.js` - Star availability
- `appointments.js` - Booking appointments
- `transactions.js` - Payment & coins
- `paymentCallback.js` - Payment webhooks
- `favorites.js` - User favorites
- `liveShows.js` - Live streaming
- `reportUsers.js` - User reports
- `messaging.js` - Chat system
- `agora.js` - Video/audio tokens
- `notifications.js` - Push notifications
- `ratings.js` - Reviews & ratings
- `analytics.js` - Analytics data
- `config.js` - App configuration
- `contactSupport.js` - Support system
- `events.js` - Events management
- `ads.js` - Advertisement system
- `admin.js` - Admin operations
- `adminDashboard.js` - Admin dashboard
- `adminManagement.js` - Admin management
- `adminRatingManagement.js` - Rating management
- `supportManager.js` - Support management

### Controller Files (controllers/):

- All route files have corresponding controller files with the same name
- Controllers contain the actual business logic for each endpoint

---

## 🔍 Quick Reference

### Most Used Endpoints:

1. `POST /api/auth/login` - User login
2. `GET /api/auth/me` - Get profile
3. `GET /api/dashboard` - Get dashboard
4. `GET /api/star` - Get stars
5. `GET /api/category` - Get categories

### Admin Only Endpoints:

- `/api/admin/*` - All admin routes
- `/api/analytics/*` - Analytics routes
- `PUT /api/config` - Config updates

### Public Endpoints (No Auth):

- `/api/auth/register`, `/api/auth/login`
- `/api/star`, `/api/category`
- `/api/live-shows` (read only)
- `/api/config` (read only)

This mapping should help you quickly find any endpoint and understand the project structure!
