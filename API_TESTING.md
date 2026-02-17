# API Testing in VS Code

This project includes comprehensive API testing tools that work directly in VS Code, eliminating the need for Postman or external tools.

## 🚀 Quick Start

### Method 1: Run Full Test Suite

```bash
npm run test
# or
node test-api.js
```

### Method 2: Quick Health Check

```bash
npm run test:quick
# or
node quick-test.js
```

### Method 3: REST Client (VS Code Extension)

1. Install "REST Client" extension in VS Code
2. Open `api-tests.http`
3. Click "Send Request" above any endpoint

## 📁 Testing Files

### `test-api.js` - Comprehensive Test Suite

- **Full automated testing** of all major endpoints
- **Authentication flow** testing
- **Error handling** validation
- **Colored output** with detailed results
- **Reusable utility functions**

**Features:**

- ✅ Health checks
- 🔐 Authentication (register/login)
- 👤 User profile management
- 🌟 Stars and categories
- 📊 Dashboard data
- 🛡️ Authorization testing
- ❌ Error handling validation

### `quick-test.js` - Fast Health Check

- **Quick validation** that server is running
- **Basic endpoint testing**
- **Interactive testing helpers**
- **Global functions** for manual testing

**Available in console:**

```javascript
// Test any GET endpoint
await testAPI.get("/category");

// Test POST with data
await testAPI.post("/auth/login", testData.user);

// Test authenticated endpoints
await testAPI.authGet("/dashboard", "your-token");
```

### `api-tests.http` - VS Code REST Client

- **Visual API testing** in VS Code
- **Pre-configured requests** for all endpoints
- **Variable support** for easy customization
- **No coding required** - just click "Send Request"

## 🛠️ Setup Requirements

### 1. Server Running

Make sure your server is running:

```bash
npm run dev
```

### 2. For REST Client (Optional)

Install VS Code extension:

- Open VS Code
- Go to Extensions (Ctrl+Shift+X)
- Search "REST Client"
- Install by Huachao Mao

## 📋 Usage Examples

### Full Test Suite

```bash
# Run all tests
npm run test

# Expected output:
🚀 BARONI API TESTING SUITE
Testing against: http://localhost:4000

✅ Health Check: Health check passed
✅ User Registration: User registration successful
✅ User Login: User login successful
✅ Get Categories: Categories retrieval successful
✅ Get All Stars: Stars retrieval successful

Total Tests: 10
Passed: 9
Failed: 1
Success Rate: 90.0%
```

### Quick Test

```bash
# Quick health check
npm run test:quick

# Expected output:
🚀 Quick API Test - Baroni Backend
Testing: http://localhost:4000

1️⃣ Testing health endpoint...
✅ Health: Baroni API

2️⃣ Testing categories endpoint...
✅ Categories: 5 found

🎉 Quick test completed successfully!
```

### Manual Testing

```bash
# Start interactive session
node quick-test.js

# Then use global functions:
> await testAPI.get('/category')
> await testAPI.post('/auth/login', testData.user)
```

### REST Client Usage

1. Open `api-tests.http` in VS Code
2. Update variables at the top:
   ```http
   @testContact = +1234567890
   @testEmail = test@example.com
   @authToken = your-token-here
   ```
3. Click "Send Request" above any endpoint
4. View response in VS Code panel

## 🔧 Customization

### Add New Test Cases

Edit `test-api.js` and add to the `runAllTests()` method:

```javascript
await testEndpoint("My New Test", () => this.testMyNewEndpoint());
```

### Add New Quick Tests

Edit `quick-test.js` and add to the `quickTest()` function:

```javascript
console.log("5️⃣ Testing my endpoint...");
const result = await axios.get(`${API_URL}/my-endpoint`);
console.log(`${green}✅ My Test: Success${reset}\n`);
```

### Add New REST Client Requests

Edit `api-tests.http` and add:

```http
### My New Endpoint
GET {{apiUrl}}/my-endpoint
Authorization: Bearer {{authToken}}
```

## 🐛 Troubleshooting

### Server Not Running

```
❌ Error: connect ECONNREFUSED ::1:4000
Make sure your server is running on http://localhost:4000
```

**Solution:** Run `npm run dev` in another terminal

### Authentication Errors

```
❌ Auth GET /dashboard - Request failed with status code 401
```

**Solution:**

1. Run login test first to get token
2. Update `@authToken` variable in `.http` files
3. Or use the automated test suite which handles auth flow

### Database Connection Issues

```
❌ Health check failed
```

**Solution:** Check your `.env` MongoDB connection string

## 📊 Test Coverage

Current test coverage includes:

- ✅ **Health & Connectivity**
- ✅ **Authentication Flow**
- ✅ **User Management**
- ✅ **Categories & Stars**
- ✅ **Dashboard Data**
- ✅ **Error Handling**
- ✅ **Security (401/404)**

### Missing Coverage (TODO):

- [ ] File uploads
- [ ] Payment endpoints
- [ ] Real-time features
- [ ] Admin-specific endpoints

## 🎯 Benefits

- **No Postman needed** - Everything in VS Code
- **Automated testing** - Run all tests with one command
- **Version controlled** - Test cases saved with code
- **Team sharing** - Everyone has same test setup
- **CI/CD ready** - Can be integrated into build pipeline
- **Documentation** - Serves as API documentation
