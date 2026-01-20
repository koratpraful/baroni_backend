# Admin Dashboard API - Integration Guide for Mobile

## Overview
This guide provides integration examples for the Admin Dashboard API with date period filtering.

## Base URL
```
http://34.142.84.222:4000/api/admin/dashboard
```

## Endpoint
**GET** `/api/admin/dashboard/overview`

## Authentication
Include the admin JWT token in the Authorization header:
```
Authorization: Bearer <YOUR_ADMIN_TOKEN>
```

## Query Parameter: Period Filter

### Supported Period Values

The API accepts the following period values (case-insensitive, with or without spaces):

| Mobile App Display | API Value (Any Format) | Description |
|-------------------|------------------------|-------------|
| "Current Month" | `current_month`, `currentmonth`, `this_month`, etc. | Current month from 1st to last day |
| "Last Month" | `last_month`, `lastmonth`, `previous_month`, etc. | Previous month |
| "This Year" | `this_year`, `thisyear`, `current_year`, etc. | January 1st to December 31st of current year |
| "Last 3 Months" | `last_3_months`, `last3months`, `last_3months`, etc. | Last 3 months from 1st of that month |
| "Last 6 Months" | `last_6_months`, `last6months`, `last_6months`, etc. | Last 6 months from 1st of that month |

**Note:** The API normalizes the period string (removes spaces, converts to lowercase), so you can send any variation like:
- `"Current Month"` → Accepted
- `"current_month"` → Accepted  
- `"CURRENT MONTH"` → Accepted
- `"currentMonth"` → Accepted

## Integration Examples

### 1. Dart/Flutter Example

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class DashboardService {
  final String baseUrl = 'http://34.142.84.222:4000';
  final String token = 'YOUR_ADMIN_TOKEN';

  // Period mapping for mobile app dropdown
  final Map<String, String> periodMapping = {
    'Current Month': 'current_month',
    'Last Month': 'last_month',
    'This Year': 'this_year',
    'Last 3 Months': 'last_3_months',
    'Last 6 Months': 'last_6_months',
  };

  Future<Map<String, dynamic>> getDashboardOverview({String? period}) async {
    try {
      // Use 'current_month' as default if no period provided
      final periodValue = period != null 
          ? periodMapping[period] ?? 'current_month'
          : 'current_month';

      final url = Uri.parse('$baseUrl/api/admin/dashboard/overview?period=$periodValue');
      
      final response = await http.get(
        url,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data;
      } else {
        throw Exception('Failed to load dashboard: ${response.statusCode}');
      }
    } catch (e) {
      print('Error fetching dashboard: $e');
      rethrow;
    }
  }
}

// Usage Example
void main() async {
  final dashboardService = DashboardService();
  
  // Get dashboard for "This Year"
  final dashboardData = await dashboardService.getDashboardOverview(
    period: 'This Year'
  );
  
  print('Total Revenue: ${dashboardData['data']['revenue']['totalRevenue']}');
  print('New Users: ${dashboardData['data']['summary']['newUsers']['count']}');
}
```

### 2. JavaScript/React Native Example

```javascript
const BASE_URL = 'http://34.142.84.222:4000';
const ADMIN_TOKEN = 'YOUR_ADMIN_TOKEN';

// Period mapping
const periodMapping = {
  'Current Month': 'current_month',
  'Last Month': 'last_month',
  'This Year': 'this_year',
  'Last 3 Months': 'last_3_months',
  'Last 6 Months': 'last_6_months',
};

// Fetch dashboard data
async function getDashboardOverview(selectedPeriod = 'Current Month') {
  try {
    // Map mobile app period to API period value
    const periodValue = periodMapping[selectedPeriod] || 'current_month';
    
    const url = `${BASE_URL}/api/admin/dashboard/overview?period=${encodeURIComponent(periodValue)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    throw error;
  }
}

// Usage Example
async function loadDashboard() {
  try {
    const dashboardData = await getDashboardOverview('This Year');
    
    console.log('Total Revenue:', dashboardData.data.revenue.totalRevenue);
    console.log('New Users:', dashboardData.data.summary.newUsers.count);
    console.log('Video Call Revenue:', dashboardData.data.revenue.serviceBreakdown.videoCall);
    console.log('Become Star Revenue:', dashboardData.data.revenue.serviceBreakdown.becomeStar);
  } catch (error) {
    console.error('Failed to load dashboard:', error);
  }
}
```

### 3. cURL Example

```bash
# Get dashboard for "Current Month"
curl --location --request GET 'http://34.142.84.222:4000/api/admin/dashboard/overview?period=current_month' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--header 'Content-Type: application/json'

# Get dashboard for "This Year"
curl --location --request GET 'http://34.142.84.222:4000/api/admin/dashboard/overview?period=this_year' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--header 'Content-Type: application/json'

# Get dashboard for "Last 3 Months"
curl --location --request GET 'http://34.142.84.222:4000/api/admin/dashboard/overview?period=last_3_months' \
--header 'Authorization: Bearer YOUR_ADMIN_TOKEN' \
--header 'Content-Type: application/json'
```

## Response Structure

```json
{
  "success": true,
  "message": "Dashboard overview retrieved successfully",
  "data": {
    "summary": {
      "newUsers": {
        "count": 13,
        "change": 5
      },
      "engagedFans": {
        "count": 8,
        "change": 2
      }
    },
    "revenue": {
      "totalRevenue": 18200,
      "escrowAmount": 240,
      "serviceBreakdown": {
        "videoCall": 8100,
        "liveShow": 0,
        "dedication": 100,
        "becomeStar": 10000
      }
    },
    "activeUsersByCountry": {
      "totalActiveUsers": 18,
      "onlineUsers": 5,
      "countries": [
        {
          "name": "Mali",
          "stars": 11,
          "fans": 4
        }
      ]
    },
    "serviceInsights": {
      "videoCall": {
        "completed": 8,
        "approved": 0,
        "cancelled": 5,
        "pending": 0,
        "uniqueFansAndStars": 12,
        "netRevenue": 8100
      },
      "liveShow": {
        "completed": 0,
        "approved": 0,
        "cancelled": 0,
        "pending": 1,
        "uniqueFansAndStars": 1,
        "netRevenue": 0
      },
      "dedication": {
        "completed": 0,
        "approved": 1,
        "cancelled": 1,
        "pending": 0,
        "uniqueFansAndStars": 4,
        "netRevenue": 100
      },
      "becomeStar": {
        "completed": 1,
        "approved": 0,
        "cancelled": 0,
        "pending": 0,
        "uniqueFansAndStars": 1,
        "netRevenue": 10000
      }
    }
  }
}
```

## Important Notes

1. **Period Parameter**: The period parameter is optional. If not provided, it defaults to `current_month`.

2. **Case Insensitive**: The API accepts period values in any case:
   - `"Current Month"` ✅
   - `"current_month"` ✅
   - `"CURRENT MONTH"` ✅

3. **Spaces Handling**: Spaces in period values are automatically normalized:
   - `"Current Month"` → `"current_month"`
   - `"Last 3 Months"` → `"last_3_months"`

4. **Error Handling**: If an invalid period is provided, the API defaults to `current_month`.

5. **Default Period**: Always use `current_month` as the default when no period is selected.

## Testing

Test with different periods to verify:
```bash
# Test each period
periods=("current_month" "last_month" "this_year" "last_3_months" "last_6_months")

for period in "${periods[@]}"; do
  echo "Testing period: $period"
  curl -s "http://34.142.84.222:4000/api/admin/dashboard/overview?period=$period" \
    -H "Authorization: Bearer YOUR_TOKEN" | jq '.data.revenue.totalRevenue'
done
```

## Support

For issues or questions, contact the backend team with:
- Period value being sent
- Expected vs actual response
- Error messages (if any)
