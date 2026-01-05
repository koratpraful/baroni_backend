/**
 * Utility functions for handling user data with default values
 * Ensures that incomplete user details return empty strings for strings and 0 for numbers
 */

/**
 * Sanitizes user data by ensuring all string fields have empty string instead of undefined/null
 * and all number fields have 0 instead of undefined/null
 * @param {Object} user - User object to sanitize
 * @returns {Object} Sanitized user object
 */
export const sanitizeUserData = (user) => {
  // If it's falsy or a primitive, return as-is
  if (!user || (typeof user !== 'object' && typeof user !== 'function')) {
    return user;
  }

  // Convert to plain object if it's a Mongoose document.
  // Note: for ObjectId, toJSON() returns a string, so guard against non-object results
  const converted = user.toJSON
    ? user.toJSON()
    : (user.toObject
      ? user.toObject()
      : (typeof user === 'object' ? { ...user } : user));

  // If conversion yielded a non-object (e.g., string ObjectId), return original value unchanged
  if (!converted || typeof converted !== 'object') {
    return user;
  }

  const userObj = converted;

  // Ensure all string fields have empty string instead of undefined/null
  const stringFields = [
    'name', 'pseudo', 'about', 'location', 'country', 'profilePic', 
    'baroniId', 'email', 'contact', 'agoraKey', 'preferredLanguage', 
    'preferredCurrency', 'fcmToken', 'apnsToken', 'voipToken'
  ];

  stringFields.forEach(field => {
    if (userObj[field] === undefined || userObj[field] === null) {
      userObj[field] = '';
    }
  });

  // Ensure all number fields have 0 instead of undefined/null
  const numberFields = [
    'coinBalance', 'profileImpressions', 'sessionVersion', 'averageRating', 'totalReviews'
  ];

  numberFields.forEach(field => {
    if (userObj[field] === undefined || userObj[field] === null) {
      userObj[field] = 0;
    }
  });

  // Handle boolean fields - ensure they have proper boolean values
  const booleanFields = [
    'availableForBookings', 'appNotification', 'hidden', 'isDeleted', 'feature_star'
  ];

  booleanFields.forEach(field => {
    if (userObj[field] === undefined || userObj[field] === null) {
      userObj[field] = false;
    }
  });

  // Format profession to include both id and name if it exists
  if (userObj.profession) {
    if (typeof userObj.profession === 'object' && userObj.profession !== null) {
      // Already populated - ensure it has id and name
      userObj.profession = {
        id: userObj.profession._id || userObj.profession.id || null,
        name: userObj.profession.name || '',
        image: userObj.profession.image || null
      };
    } else if (typeof userObj.profession === 'string') {
      // Just an ID string - keep it but we'll format it in createSanitizedUserResponse
      // For now, leave it as is
    }
  }

  return userObj;
};

/**
 * Sanitizes an array of user objects
 * @param {Array} users - Array of user objects to sanitize
 * @returns {Array} Array of sanitized user objects
 */
export const sanitizeUserDataArray = (users) => {
  if (!Array.isArray(users)) {
    return users;
  }
  return users.map(user => sanitizeUserData(user));
};

/**
 * Sanitizes user data in nested objects (like populated fields)
 * @param {Object} obj - Object that may contain user data
 * @param {Array} userFields - Array of field names that contain user objects
 * @returns {Object} Object with sanitized user data
 */
export const sanitizeNestedUserData = (obj, userFields = []) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result = { ...obj };

  userFields.forEach(field => {
    if (result[field]) {
      if (Array.isArray(result[field])) {
        result[field] = sanitizeUserDataArray(result[field]);
      } else {
        result[field] = sanitizeUserData(result[field]);
      }
    }
  });

  return result;
};

/**
 * Formats profession object to include both id and name
 * @param {Object|String|undefined} profession - Profession object or ID
 * @returns {Object|null} Formatted profession with id and name
 */
export const formatProfession = (profession) => {
  if (!profession) {
    return null;
  }
  
  // If it's already an object with _id or id
  if (typeof profession === 'object') {
    return {
      id: profession._id || profession.id || null,
      name: profession.name || ''
    };
  }
  
  // If it's just an ID string
  if (typeof profession === 'string') {
    return {
      id: profession,
      name: ''
    };
  }
  
  return null;
};

/**
 * Creates a sanitized user object for API responses
 * This is a more comprehensive version that includes all user fields
 * @param {Object} user - User object to sanitize
 * @returns {Object} Sanitized user object for API response
 */
export const createSanitizedUserResponse = (user) => {
  const sanitized = sanitizeUserData(user);
  
  // Calculate status based on availableForBookings and hidden
  // active: availableForBookings === true && hidden !== true
  // blocked: availableForBookings === false || hidden === true
  const status = (sanitized.availableForBookings === true && sanitized.hidden !== true) 
    ? 'active' 
    : 'blocked';
  
  return {
    id: sanitized._id || sanitized.id,
    baroniId: sanitized.baroniId,
    contact: sanitized.contact,
    email: sanitized.email,
    name: sanitized.name,
    pseudo: sanitized.pseudo,
    profilePic: sanitized.profilePic,
    preferredLanguage: sanitized.preferredLanguage,
    preferredCurrency: sanitized.preferredCurrency,
    country: sanitized.country,
    about: sanitized.about,
    location: sanitized.location,
    profession: formatProfession(sanitized.profession),
    role: sanitized.role,
    availableForBookings: sanitized.availableForBookings,
    appNotification: sanitized.appNotification,
    hidden: sanitized.hidden,
    status: status,
    feature_star: sanitized.feature_star,
    coinBalance: sanitized.coinBalance,
    agoraKey: sanitized.agoraKey,
    profileImpressions: sanitized.profileImpressions,
    averageRating: sanitized.averageRating,
    totalReviews: sanitized.totalReviews,
    fcmToken: sanitized.fcmToken,
    apnsToken: sanitized.apnsToken,
    voipToken: sanitized.voipToken,
    deviceType: sanitized.deviceType,
    isDev: sanitized.isDev,
    createdAt: sanitized.createdAt,
    updatedAt: sanitized.updatedAt
  };
};

