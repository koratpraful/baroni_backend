# Toggle Fields API Guide

## API Endpoint

**PATCH** `/api/admin/management/user/:id`

આ એક unified API છે જે તમામ toggle fields ને manage કરે છે.

## Toggle Fields

### 1. `availableForBookings`
- **Type**: boolean
- **Description**: Available for bookings toggle
- **Values**: `true` / `false`

### 2. `hidden`
- **Type**: boolean
- **Description**: Hidden mode toggle
- **Values**: `true` / `false`

### 3. `appNotification`
- **Type**: boolean
- **Description**: App notifications toggle
- **Values**: `true` / `false`

### 4. `feature_star`
- **Type**: boolean
- **Description**: Add in feature stars toggle
- **Values**: `true` / `false`
- **Note**: માત્ર STAR users માટે જ કામ કરે છે (FAN માટે ignore થાય છે)

## API Usage Examples

### Example 1: Single Toggle Update

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/USER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "availableForBookings": true
  }'
```

### Example 2: Multiple Toggles Update

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/USER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "availableForBookings": true,
    "hidden": false,
    "appNotification": true,
    "isVerified": true,
    "feature_star": true
  }'
```

### Example 3: All Toggles Together

```json
{
  "availableForBookings": true,
  "hidden": false,
  "appNotification": true,
  "isVerified": true,
  "feature_star": true
}
```

## Status Field (Alternative Method)

તમે `status` field નો પણ ઉપયોગ કરી શકો છો જે automatically `availableForBookings` અને `hidden` ને manage કરે છે:

```json
{
  "status": "active"
}
```

**Status Values:**
- `"active"` → `availableForBookings: true`, `hidden: false`
- `"blocked"` → `availableForBookings: false`, `hidden: true`
- `"inactive"` → `availableForBookings: false`, `hidden: true`

### Example with Status

```bash
curl -X PATCH "https://api.example.com/api/admin/management/user/USER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active",
    "appNotification": true,
    "isVerified": true,
    "feature_star": true
  }'
```

## Complete Request Example

```json
{
  "name": "Emma Johnson",
  "availableForBookings": true,
  "hidden": false,
  "appNotification": true,
  "isVerified": true,
  "feature_star": true
}
```

## Response Example

```json
{
  "success": true,
  "message": "User profile updated successfully",
  "data": {
    "user": {
      "id": "user_id",
      "name": "Emma Johnson",
      "availableForBookings": true,
      "hidden": false,
      "appNotification": true,
      "isVerified": true,
      "feature_star": true,
      "status": "active"
    }
  }
}
```

## Important Notes

### 1. Partial Updates
- તમે માત્ર જે toggle change કરવા માંગો છો તે જ send કરો
- બાકીના fields optional છે

### 2. Feature Star
- `feature_star` માત્ર STAR users માટે જ કામ કરે છે
- જો FAN user માટે send કરો તો silently ignore થશે

### 3. Status vs Individual Toggles
- `status` field use કરવાથી `availableForBookings` અને `hidden` automatically set થાય છે
- અથવા તમે individually પણ set કરી શકો છો

### 4. All Toggles Work for Both FAN and STAR
- `availableForBookings` ✅ FAN & STAR
- `hidden` ✅ FAN & STAR
- `appNotification` ✅ FAN & STAR
- `isVerified` ✅ FAN & STAR
- `feature_star` ⭐ માત્ર STAR

## Frontend Implementation Example

```javascript
// Update single toggle
async function updateToggle(userId, toggleName, value) {
  const response = await fetch(`/api/admin/management/user/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      [toggleName]: value
    })
  });
  return await response.json();
}

// Usage
updateToggle(userId, 'availableForBookings', true);
updateToggle(userId, 'hidden', false);
updateToggle(userId, 'appNotification', true);
updateToggle(userId, 'feature_star', true);

// Update multiple toggles at once
async function updateMultipleToggles(userId, toggles) {
  const response = await fetch(`/api/admin/management/user/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(toggles)
  });
  return await response.json();
}

// Usage
updateMultipleToggles(userId, {
  availableForBookings: true,
  hidden: false,
  appNotification: true,
  isVerified: true,
  feature_star: true
});
```

## React Example

```jsx
function ToggleSwitch({ userId, field, value, label, onChange }) {
  const handleToggle = async (newValue) => {
    try {
      const response = await fetch(`/api/admin/management/user/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [field]: newValue
        })
      });
      const data = await response.json();
      if (data.success) {
        onChange(newValue);
      }
    } catch (error) {
      console.error('Toggle update failed:', error);
    }
  };

  return (
    <div>
      <label>{label}</label>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => handleToggle(e.target.checked)}
      />
    </div>
  );
}

// Usage
<ToggleSwitch
  userId={userId}
  field="availableForBookings"
  value={user.availableForBookings}
  label="Available for Bookings"
  onChange={(value) => setUser({...user, availableForBookings: value})}
/>

<ToggleSwitch
  userId={userId}
  field="hidden"
  value={user.hidden}
  label="Hidden Mode"
  onChange={(value) => setUser({...user, hidden: value})}
/>

<ToggleSwitch
  userId={userId}
  field="appNotification"
  value={user.appNotification}
  label="App Notification"
  onChange={(value) => setUser({...user, appNotification: value})}
/>

<ToggleSwitch
  userId={userId}
  field="feature_star"
  value={user.feature_star}
  label="Add In Feature Stars"
  onChange={(value) => setUser({...user, feature_star: value})}
/>
```

## Summary

- **API**: `PATCH /api/admin/management/user/:id`
- **All toggles**: એક જ API થી manage થાય છે
- **Partial updates**: માત્ર જે toggle change કરવો હોય તે જ send કરો
- **Status field**: `availableForBookings` અને `hidden` ને automatically manage કરે છે
- **Feature star**: માત્ર STAR users માટે જ કામ કરે છે

---

For complete API documentation, see:
- `UNIFIED_STAR_PROFILE_UPDATE_API.md` - Complete unified API
- `FAN_AND_STAR_UPDATE_API.md` - Fan and Star differences








