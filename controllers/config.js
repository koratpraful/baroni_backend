import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import Config from '../models/Config.js';
import Category from '../models/Category.js';
import CountryServiceConfig from '../models/CountryServiceConfig.js';

const sanitizeConfig = (cfg) => ({
  id: cfg._id,
  // Existing fields
  liveShowPriceHide: cfg.liveShowPriceHide,
  videoCallPriceHide: cfg.videoCallPriceHide,
  becomeBaronistarPriceHide: cfg.becomeBaronistarPriceHide,
  isTestUser: cfg.isTestUser,
  
  // App Configuration
  appName: cfg.appName,
  appVersion: cfg.appVersion,
  maintenanceMode: cfg.maintenanceMode,
  registrationEnabled: cfg.registrationEnabled,
  debugMode: cfg.debugMode,
  
  // File Upload Configuration
  maxFileSize: cfg.maxFileSize,
  supportedImageFormats: cfg.supportedImageFormats,
  supportedVideoFormats: cfg.supportedVideoFormats,
  
  // Localization Configuration
  defaultLanguage: cfg.defaultLanguage,
  supportedLanguages: cfg.supportedLanguages,
  
  // Currency Configuration
  defaultCurrency: cfg.defaultCurrency,
  supportedCurrencies: cfg.supportedCurrencies,
  
  // Transaction Configuration
  maxCoinsPerTransaction: cfg.maxCoinsPerTransaction,
  minCoinsPerTransaction: cfg.minCoinsPerTransaction,
  commissionRate: cfg.commissionRate,
  
  // Feature Flags
  paymentGatewayEnabled: cfg.paymentGatewayEnabled,
  notificationEnabled: cfg.notificationEnabled,
  analyticsEnabled: cfg.analyticsEnabled,
  
  // Nested objects
  serviceLimits: cfg.serviceLimits,
  idVerificationFees: cfg.idVerificationFees,
  liveShowFees: cfg.liveShowFees,
  contactSupport: cfg.contactSupport,
  hideElementsPrice: cfg.hideElementsPrice,
  hideApplyToBecomeStar: cfg.hideApplyToBecomeStar,
  adsInterval: cfg.adsInterval,
  
  createdAt: cfg.createdAt,
  updatedAt: cfg.updatedAt,
});

// Get Global Configuration
export const getGlobalConfig = async (_req, res) => {
  try {
    const cfg = await Config.getSingleton();
    return res.json({ 
      success: true, 
      message: 'Global configuration retrieved successfully',
      data: {
        config: sanitizeConfig(cfg)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Update Global Configuration
export const updateGlobalConfig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    // Get or create singleton config document
    let cfg = await Config.findOne();
    if (!cfg) {
      // Create new config if none exists (with all defaults)
      cfg = await Config.create({});
      console.log('[UpdateGlobalConfig] Created new config document with defaults');
    } else {
      console.log('[UpdateGlobalConfig] Found existing config document:', cfg._id);
      // Ensure all nested objects exist (initialize if missing)
      if (!cfg.serviceLimits) cfg.serviceLimits = {};
      if (!cfg.idVerificationFees) cfg.idVerificationFees = {};
      if (!cfg.liveShowFees) cfg.liveShowFees = {};
      if (!cfg.contactSupport) cfg.contactSupport = {};
      if (!cfg.hideElementsPrice) cfg.hideElementsPrice = {};
    }

    console.log('[UpdateGlobalConfig] Received update data:', JSON.stringify(req.body, null, 2));

    // Map of nested keys to their parent objects
    const nestedKeyMap = {
      // serviceLimits keys
      'liveShowDuration': 'serviceLimits',
      'videoCallDuration': 'serviceLimits',
      'slotDuration': 'serviceLimits',
      'dedicationUploadSize': 'serviceLimits',
      'maxLiveShowParticipants': 'serviceLimits',
      'reconnectionTimeout': 'serviceLimits',
      // idVerificationFees keys
      'standardIdPrice': 'idVerificationFees',
      'goldIdPrice': 'idVerificationFees',
      // liveShowFees keys
      'hostingFee': 'liveShowFees',
      // contactSupport keys
      'companyServiceNumber': 'contactSupport',
      'supportEmail': 'contactSupport',
      'servicesTermsUrl': 'contactSupport',
      'privacyPolicyUrl': 'contactSupport',
      'helpdeskLink': 'contactSupport',
      // hideElementsPrice keys
      'hideDedications': 'hideElementsPrice'
    };

    const {
      liveShowPriceHide,
      videoCallPriceHide,
      becomeBaronistarPriceHide,
      isTestUser,
      appName,
      appVersion,
      maintenanceMode,
      registrationEnabled,
      debugMode,
      maxFileSize,
      supportedImageFormats,
      supportedVideoFormats,
      defaultLanguage,
      supportedLanguages,
      defaultCurrency,
      supportedCurrencies,
      maxCoinsPerTransaction,
      minCoinsPerTransaction,
      commissionRate,
      paymentGatewayEnabled,
      notificationEnabled,
      analyticsEnabled,
      serviceLimits,
      idVerificationFees,
      liveShowFees,
      contactSupport,
      hideElementsPrice,
  hideApplyToBecomeStar,
  adsInterval,
  homeFeedAdInterval // backward compatibility if old key is still sent
    } = req.body;

    const normalize = (val) => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') {
        const lower = val.toLowerCase().trim();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
      }
      if (typeof val === 'number') {
        return val === 1 ? true : (val === 0 ? false : undefined);
      }
      return undefined;
    };

    // Update boolean fields - only update if value is provided (not undefined)
    if (liveShowPriceHide !== undefined) {
      const normalized = normalize(liveShowPriceHide);
      if (normalized !== undefined) {
        cfg.liveShowPriceHide = normalized;
        console.log(`[UpdateGlobalConfig] Updated liveShowPriceHide: ${cfg.liveShowPriceHide}`);
      }
    }
    
    if (videoCallPriceHide !== undefined) {
      const normalized = normalize(videoCallPriceHide);
      if (normalized !== undefined) {
        cfg.videoCallPriceHide = normalized;
        console.log(`[UpdateGlobalConfig] Updated videoCallPriceHide: ${cfg.videoCallPriceHide}`);
      }
    }
    
    if (becomeBaronistarPriceHide !== undefined) {
      const normalized = normalize(becomeBaronistarPriceHide);
      if (normalized !== undefined) {
        cfg.becomeBaronistarPriceHide = normalized;
        console.log(`[UpdateGlobalConfig] Updated becomeBaronistarPriceHide: ${cfg.becomeBaronistarPriceHide}`);
      }
    }
    
    if (isTestUser !== undefined) {
      const normalized = normalize(isTestUser);
      if (normalized !== undefined) {
        cfg.isTestUser = normalized;
        console.log(`[UpdateGlobalConfig] Updated isTestUser: ${cfg.isTestUser}`);
      }
    }
    
    if (hideApplyToBecomeStar !== undefined) {
      const normalized = normalize(hideApplyToBecomeStar);
      if (normalized !== undefined) {
        cfg.hideApplyToBecomeStar = normalized;
        console.log(`[UpdateGlobalConfig] Updated hideApplyToBecomeStar: ${cfg.hideApplyToBecomeStar}`);
      }
    }

    // Update App Configuration fields
    if (appName !== undefined && typeof appName === 'string' && appName.trim()) {
      cfg.appName = appName.trim();
      console.log(`[UpdateGlobalConfig] Updated appName: ${cfg.appName}`);
    }
    
    if (appVersion !== undefined && typeof appVersion === 'string' && appVersion.trim()) {
      cfg.appVersion = appVersion.trim();
      console.log(`[UpdateGlobalConfig] Updated appVersion: ${cfg.appVersion}`);
    }
    
    if (maintenanceMode !== undefined) {
      const normalized = normalize(maintenanceMode);
      if (normalized !== undefined) {
        cfg.maintenanceMode = normalized;
        console.log(`[UpdateGlobalConfig] Updated maintenanceMode: ${cfg.maintenanceMode}`);
      }
    }
    
    if (registrationEnabled !== undefined) {
      const normalized = normalize(registrationEnabled);
      if (normalized !== undefined) {
        cfg.registrationEnabled = normalized;
        console.log(`[UpdateGlobalConfig] Updated registrationEnabled: ${cfg.registrationEnabled}`);
      }
    }
    
    if (debugMode !== undefined) {
      const normalized = normalize(debugMode);
      if (normalized !== undefined) {
        cfg.debugMode = normalized;
        console.log(`[UpdateGlobalConfig] Updated debugMode: ${cfg.debugMode}`);
      }
    }

    // Update File Upload Configuration
    if (maxFileSize !== undefined && typeof maxFileSize === 'number' && maxFileSize > 0) {
      cfg.maxFileSize = maxFileSize;
      console.log(`[UpdateGlobalConfig] Updated maxFileSize: ${cfg.maxFileSize}`);
    }
    
    if (supportedImageFormats !== undefined && Array.isArray(supportedImageFormats)) {
      cfg.supportedImageFormats = supportedImageFormats.filter(f => typeof f === 'string' && f.trim());
      console.log(`[UpdateGlobalConfig] Updated supportedImageFormats:`, cfg.supportedImageFormats);
    }
    
    if (supportedVideoFormats !== undefined && Array.isArray(supportedVideoFormats)) {
      cfg.supportedVideoFormats = supportedVideoFormats.filter(f => typeof f === 'string' && f.trim());
      console.log(`[UpdateGlobalConfig] Updated supportedVideoFormats:`, cfg.supportedVideoFormats);
    }

    // Update Localization Configuration
    if (defaultLanguage !== undefined && typeof defaultLanguage === 'string' && defaultLanguage.trim()) {
      cfg.defaultLanguage = defaultLanguage.trim();
      console.log(`[UpdateGlobalConfig] Updated defaultLanguage: ${cfg.defaultLanguage}`);
    }
    
    if (supportedLanguages !== undefined && Array.isArray(supportedLanguages)) {
      cfg.supportedLanguages = supportedLanguages.filter(l => typeof l === 'string' && l.trim());
      console.log(`[UpdateGlobalConfig] Updated supportedLanguages:`, cfg.supportedLanguages);
    }

    // Update Currency Configuration
    if (defaultCurrency !== undefined && typeof defaultCurrency === 'string' && defaultCurrency.trim()) {
      cfg.defaultCurrency = defaultCurrency.trim().toUpperCase();
      console.log(`[UpdateGlobalConfig] Updated defaultCurrency: ${cfg.defaultCurrency}`);
    }
    
    if (supportedCurrencies !== undefined && Array.isArray(supportedCurrencies)) {
      cfg.supportedCurrencies = supportedCurrencies.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim().toUpperCase());
      console.log(`[UpdateGlobalConfig] Updated supportedCurrencies:`, cfg.supportedCurrencies);
    }

    // Update Transaction Configuration
    if (maxCoinsPerTransaction !== undefined && typeof maxCoinsPerTransaction === 'number' && maxCoinsPerTransaction > 0) {
      cfg.maxCoinsPerTransaction = maxCoinsPerTransaction;
      console.log(`[UpdateGlobalConfig] Updated maxCoinsPerTransaction: ${cfg.maxCoinsPerTransaction}`);
    }
    
    if (minCoinsPerTransaction !== undefined && typeof minCoinsPerTransaction === 'number' && minCoinsPerTransaction > 0) {
      cfg.minCoinsPerTransaction = minCoinsPerTransaction;
      console.log(`[UpdateGlobalConfig] Updated minCoinsPerTransaction: ${cfg.minCoinsPerTransaction}`);
    }
    
    if (commissionRate !== undefined && typeof commissionRate === 'number' && commissionRate >= 0) {
      cfg.commissionRate = commissionRate;
      console.log(`[UpdateGlobalConfig] Updated commissionRate: ${cfg.commissionRate}`);
    }

    // Update Feature Flags
    if (paymentGatewayEnabled !== undefined) {
      const normalized = normalize(paymentGatewayEnabled);
      if (normalized !== undefined) {
        cfg.paymentGatewayEnabled = normalized;
        console.log(`[UpdateGlobalConfig] Updated paymentGatewayEnabled: ${cfg.paymentGatewayEnabled}`);
      }
    }
    
    if (notificationEnabled !== undefined) {
      const normalized = normalize(notificationEnabled);
      if (normalized !== undefined) {
        cfg.notificationEnabled = normalized;
        console.log(`[UpdateGlobalConfig] Updated notificationEnabled: ${cfg.notificationEnabled}`);
      }
    }
    
    if (analyticsEnabled !== undefined) {
      const normalized = normalize(analyticsEnabled);
      if (normalized !== undefined) {
        cfg.analyticsEnabled = normalized;
        console.log(`[UpdateGlobalConfig] Updated analyticsEnabled: ${cfg.analyticsEnabled}`);
      }
    }

    // Update home feed ads interval (new key)
    const intervalValue = adsInterval !== undefined ? adsInterval : homeFeedAdInterval;
    if (intervalValue !== undefined) {
      const parsed = Number(intervalValue);
      if (!Number.isNaN(parsed) && parsed > 0) {
        cfg.adsInterval = parsed;
        console.log(`[UpdateGlobalConfig] Updated adsInterval: ${cfg.adsInterval}`);
      }
    }

    // Handle flat nested keys (e.g., maxLiveShowParticipants sent directly, not in serviceLimits object)
    // Process flat keys from original req.body
    // If both flat key and nested object are provided, nested object will take precedence (processed later)
    const updatedNestedParents = new Set();
    for (const [key, parent] of Object.entries(nestedKeyMap)) {
      if (req.body.hasOwnProperty(key)) {
        // Check if this key is also in the nested object - if so, nested will take precedence
        const nestedValue = req.body[parent] && req.body[parent][key];
        if (nestedValue === undefined) {
          // Key exists at top level and NOT in nested object, update it directly
          const value = req.body[key];
          if (value !== undefined) {
            // Ensure parent object exists
            if (!cfg[parent]) cfg[parent] = {};
            
            // Update the nested key
            cfg[parent][key] = value;
            updatedNestedParents.add(parent);
            console.log(`[UpdateGlobalConfig] Updated ${parent}.${key} from flat key: ${value}`);
          }
        } else {
          console.log(`[UpdateGlobalConfig] Skipping flat key "${key}" - found in nested object ${parent}, nested value will be used`);
        }
      }
    }
    
    // Mark all updated nested parents as modified
    updatedNestedParents.forEach(parent => {
      cfg.markModified(parent);
    });

    // Update nested objects - merge with existing values
    // Use markModified to ensure Mongoose detects changes in nested objects
    if (serviceLimits && typeof serviceLimits === 'object' && !Array.isArray(serviceLimits)) {
      // Ensure serviceLimits object exists
      if (!cfg.serviceLimits) cfg.serviceLimits = {};
      
      // Merge individual fields from serviceLimits (only update if provided)
      if (serviceLimits.liveShowDuration !== undefined) cfg.serviceLimits.liveShowDuration = serviceLimits.liveShowDuration;
      if (serviceLimits.videoCallDuration !== undefined) cfg.serviceLimits.videoCallDuration = serviceLimits.videoCallDuration;
      if (serviceLimits.slotDuration !== undefined) cfg.serviceLimits.slotDuration = serviceLimits.slotDuration;
      if (serviceLimits.dedicationUploadSize !== undefined) cfg.serviceLimits.dedicationUploadSize = serviceLimits.dedicationUploadSize;
      if (serviceLimits.maxLiveShowParticipants !== undefined) cfg.serviceLimits.maxLiveShowParticipants = serviceLimits.maxLiveShowParticipants;
      if (serviceLimits.reconnectionTimeout !== undefined) cfg.serviceLimits.reconnectionTimeout = serviceLimits.reconnectionTimeout;
      
      // Ensure defaults for missing fields
      if (cfg.serviceLimits.liveShowDuration === undefined) cfg.serviceLimits.liveShowDuration = 20;
      if (cfg.serviceLimits.videoCallDuration === undefined) cfg.serviceLimits.videoCallDuration = 5;
      if (cfg.serviceLimits.slotDuration === undefined) cfg.serviceLimits.slotDuration = 10;
      if (cfg.serviceLimits.dedicationUploadSize === undefined) cfg.serviceLimits.dedicationUploadSize = 20;
      if (cfg.serviceLimits.maxLiveShowParticipants === undefined) cfg.serviceLimits.maxLiveShowParticipants = 10000;
      if (cfg.serviceLimits.reconnectionTimeout === undefined) cfg.serviceLimits.reconnectionTimeout = 5;
      
      cfg.markModified('serviceLimits');
      console.log(`[UpdateGlobalConfig] Updated serviceLimits:`, cfg.serviceLimits);
    }
    
    if (idVerificationFees && typeof idVerificationFees === 'object' && !Array.isArray(idVerificationFees)) {
      // Ensure idVerificationFees object exists
      if (!cfg.idVerificationFees) cfg.idVerificationFees = {};
      
      if (idVerificationFees.standardIdPrice !== undefined) cfg.idVerificationFees.standardIdPrice = idVerificationFees.standardIdPrice;
      if (idVerificationFees.goldIdPrice !== undefined) cfg.idVerificationFees.goldIdPrice = idVerificationFees.goldIdPrice;
      
      // Ensure defaults for missing fields
      if (cfg.idVerificationFees.standardIdPrice === undefined) cfg.idVerificationFees.standardIdPrice = 0;
      if (cfg.idVerificationFees.goldIdPrice === undefined) cfg.idVerificationFees.goldIdPrice = 0;
      
      cfg.markModified('idVerificationFees');
      console.log(`[UpdateGlobalConfig] Updated idVerificationFees:`, cfg.idVerificationFees);
    }
    
    if (liveShowFees && typeof liveShowFees === 'object' && !Array.isArray(liveShowFees)) {
      // Ensure liveShowFees object exists
      if (!cfg.liveShowFees) cfg.liveShowFees = {};
      
      if (liveShowFees.hostingFee !== undefined) cfg.liveShowFees.hostingFee = liveShowFees.hostingFee;
      
      // Ensure defaults for missing fields
      if (cfg.liveShowFees.hostingFee === undefined) cfg.liveShowFees.hostingFee = 0;
      
      cfg.markModified('liveShowFees');
      console.log(`[UpdateGlobalConfig] Updated liveShowFees:`, cfg.liveShowFees);
    }
    
    if (contactSupport && typeof contactSupport === 'object' && !Array.isArray(contactSupport)) {
      // Ensure contactSupport object exists
      if (!cfg.contactSupport) cfg.contactSupport = {};
      
      if (contactSupport.companyServiceNumber !== undefined) cfg.contactSupport.companyServiceNumber = contactSupport.companyServiceNumber;
      if (contactSupport.supportEmail !== undefined) cfg.contactSupport.supportEmail = contactSupport.supportEmail;
      if (contactSupport.servicesTermsUrl !== undefined) cfg.contactSupport.servicesTermsUrl = contactSupport.servicesTermsUrl;
      if (contactSupport.privacyPolicyUrl !== undefined) cfg.contactSupport.privacyPolicyUrl = contactSupport.privacyPolicyUrl;
      if (contactSupport.helpdeskLink !== undefined) cfg.contactSupport.helpdeskLink = contactSupport.helpdeskLink;
      
      // Ensure defaults for missing fields
      if (!cfg.contactSupport.companyServiceNumber) cfg.contactSupport.companyServiceNumber = '+34895723487';
      if (!cfg.contactSupport.supportEmail) cfg.contactSupport.supportEmail = 'support@playform.com';
      if (!cfg.contactSupport.servicesTermsUrl) cfg.contactSupport.servicesTermsUrl = 'https://help.platform.com';
      if (!cfg.contactSupport.privacyPolicyUrl) cfg.contactSupport.privacyPolicyUrl = 'https://help.platform.com';
      if (!cfg.contactSupport.helpdeskLink) cfg.contactSupport.helpdeskLink = 'https://help.platform.com';
      
      cfg.markModified('contactSupport');
      console.log(`[UpdateGlobalConfig] Updated contactSupport:`, cfg.contactSupport);
    }
    
    if (hideElementsPrice && typeof hideElementsPrice === 'object' && !Array.isArray(hideElementsPrice)) {
      // Ensure hideElementsPrice object exists
      if (!cfg.hideElementsPrice) cfg.hideElementsPrice = {};
      
      if (hideElementsPrice.hideDedications !== undefined) {
        const normalized = normalize(hideElementsPrice.hideDedications);
        if (normalized !== undefined) {
          cfg.hideElementsPrice.hideDedications = normalized;
        }
      }
      
      // Ensure defaults for missing fields
      if (cfg.hideElementsPrice.hideDedications === undefined) cfg.hideElementsPrice.hideDedications = false;
      
      cfg.markModified('hideElementsPrice');
      console.log(`[UpdateGlobalConfig] Updated hideElementsPrice:`, cfg.hideElementsPrice);
    }

    // Ensure ALL fields have defaults BEFORE saving
    // This ensures response always contains all fields even if only one key was updated
    
    // App Configuration defaults
    if (!cfg.appName) cfg.appName = 'Baroni';
    if (!cfg.appVersion) cfg.appVersion = '1.0.0';
    if (cfg.maintenanceMode === undefined || cfg.maintenanceMode === null) cfg.maintenanceMode = false;
    if (cfg.registrationEnabled === undefined || cfg.registrationEnabled === null) cfg.registrationEnabled = true;
    if (cfg.debugMode === undefined || cfg.debugMode === null) cfg.debugMode = false;
    
    // File Upload Configuration defaults
    if (!cfg.maxFileSize || cfg.maxFileSize === 0) cfg.maxFileSize = 5242880;
    if (!cfg.supportedImageFormats || !Array.isArray(cfg.supportedImageFormats) || cfg.supportedImageFormats.length === 0) {
      cfg.supportedImageFormats = ['jpg', 'jpeg', 'png', 'gif'];
    }
    if (!cfg.supportedVideoFormats || !Array.isArray(cfg.supportedVideoFormats) || cfg.supportedVideoFormats.length === 0) {
      cfg.supportedVideoFormats = ['mp4', 'mov', 'avi'];
    }
    
    // Localization Configuration defaults
    if (!cfg.defaultLanguage) cfg.defaultLanguage = 'en';
    if (!cfg.supportedLanguages || !Array.isArray(cfg.supportedLanguages) || cfg.supportedLanguages.length === 0) {
      cfg.supportedLanguages = ['en', 'fr', 'es'];
    }
    
    // Currency Configuration defaults
    if (!cfg.defaultCurrency) cfg.defaultCurrency = 'USD';
    if (!cfg.supportedCurrencies || !Array.isArray(cfg.supportedCurrencies) || cfg.supportedCurrencies.length === 0) {
      cfg.supportedCurrencies = ['USD', 'EUR', 'GBP'];
    }
    
    // Transaction Configuration defaults
    if (!cfg.maxCoinsPerTransaction || cfg.maxCoinsPerTransaction === 0) cfg.maxCoinsPerTransaction = 10000;
    if (!cfg.minCoinsPerTransaction || cfg.minCoinsPerTransaction === 0) cfg.minCoinsPerTransaction = 1;
    if (cfg.commissionRate === undefined || cfg.commissionRate === null) cfg.commissionRate = 0.1;
    
    // Feature Flags defaults
    if (cfg.paymentGatewayEnabled === undefined || cfg.paymentGatewayEnabled === null) cfg.paymentGatewayEnabled = true;
    if (cfg.notificationEnabled === undefined || cfg.notificationEnabled === null) cfg.notificationEnabled = true;
    if (cfg.analyticsEnabled === undefined || cfg.analyticsEnabled === null) cfg.analyticsEnabled = true;
    
    // Nested objects defaults
    if (!cfg.serviceLimits) cfg.serviceLimits = {};
    if (!cfg.idVerificationFees) cfg.idVerificationFees = {};
    if (!cfg.liveShowFees) cfg.liveShowFees = {};
    if (!cfg.contactSupport) cfg.contactSupport = {};
    if (!cfg.hideElementsPrice) cfg.hideElementsPrice = {};
    
    // Ensure all nested object fields have defaults (even if not updated)
    // serviceLimits defaults
    if (cfg.serviceLimits.liveShowDuration === undefined || cfg.serviceLimits.liveShowDuration === null) cfg.serviceLimits.liveShowDuration = 20;
    if (cfg.serviceLimits.videoCallDuration === undefined || cfg.serviceLimits.videoCallDuration === null) cfg.serviceLimits.videoCallDuration = 5;
    if (cfg.serviceLimits.slotDuration === undefined || cfg.serviceLimits.slotDuration === null) cfg.serviceLimits.slotDuration = 10;
    if (cfg.serviceLimits.dedicationUploadSize === undefined || cfg.serviceLimits.dedicationUploadSize === null) cfg.serviceLimits.dedicationUploadSize = 20;
    if (cfg.serviceLimits.maxLiveShowParticipants === undefined || cfg.serviceLimits.maxLiveShowParticipants === null) cfg.serviceLimits.maxLiveShowParticipants = 10000;
    if (cfg.serviceLimits.reconnectionTimeout === undefined || cfg.serviceLimits.reconnectionTimeout === null) cfg.serviceLimits.reconnectionTimeout = 5;
    
    // idVerificationFees defaults
    if (cfg.idVerificationFees.standardIdPrice === undefined || cfg.idVerificationFees.standardIdPrice === null) cfg.idVerificationFees.standardIdPrice = 0;
    if (cfg.idVerificationFees.goldIdPrice === undefined || cfg.idVerificationFees.goldIdPrice === null) cfg.idVerificationFees.goldIdPrice = 0;
    
    // liveShowFees defaults
    if (cfg.liveShowFees.hostingFee === undefined || cfg.liveShowFees.hostingFee === null) cfg.liveShowFees.hostingFee = 0;
    
    // contactSupport defaults
    if (!cfg.contactSupport.companyServiceNumber) cfg.contactSupport.companyServiceNumber = '+34895723487';
    if (!cfg.contactSupport.supportEmail) cfg.contactSupport.supportEmail = 'support@playform.com';
    if (!cfg.contactSupport.servicesTermsUrl) cfg.contactSupport.servicesTermsUrl = 'https://help.platform.com';
    if (!cfg.contactSupport.privacyPolicyUrl) cfg.contactSupport.privacyPolicyUrl = 'https://help.platform.com';
    if (!cfg.contactSupport.helpdeskLink) cfg.contactSupport.helpdeskLink = 'https://help.platform.com';
    
    // hideElementsPrice defaults
    if (cfg.hideElementsPrice.hideDedications === undefined || cfg.hideElementsPrice.hideDedications === null) cfg.hideElementsPrice.hideDedications = false;
    
    // Mark all nested objects as modified to ensure they're saved
    cfg.markModified('serviceLimits');
    cfg.markModified('idVerificationFees');
    cfg.markModified('liveShowFees');
    cfg.markModified('contactSupport');
    cfg.markModified('hideElementsPrice');
    
    // Save the updated config
    const saved = await cfg.save();
    console.log('[UpdateGlobalConfig] Config saved successfully:', saved._id);
    
    // Reload from database to ensure we have the latest values with all defaults
    const finalConfig = await Config.findById(saved._id);
    if (!finalConfig) {
      throw new Error('Failed to retrieve updated config');
    }
    
    // Ensure all fields are properly populated in the final config
    // This is a safety check - should already be done above, but ensures response completeness
    
    // App Configuration defaults
    if (!finalConfig.appName) finalConfig.appName = 'Baroni';
    if (!finalConfig.appVersion) finalConfig.appVersion = '1.0.0';
    if (finalConfig.maintenanceMode === undefined || finalConfig.maintenanceMode === null) finalConfig.maintenanceMode = false;
    if (finalConfig.registrationEnabled === undefined || finalConfig.registrationEnabled === null) finalConfig.registrationEnabled = true;
    if (finalConfig.debugMode === undefined || finalConfig.debugMode === null) finalConfig.debugMode = false;
    
    // File Upload Configuration defaults
    if (!finalConfig.maxFileSize) finalConfig.maxFileSize = 5242880;
    if (!finalConfig.supportedImageFormats || !Array.isArray(finalConfig.supportedImageFormats) || finalConfig.supportedImageFormats.length === 0) {
      finalConfig.supportedImageFormats = ['jpg', 'jpeg', 'png', 'gif'];
    }
    if (!finalConfig.supportedVideoFormats || !Array.isArray(finalConfig.supportedVideoFormats) || finalConfig.supportedVideoFormats.length === 0) {
      finalConfig.supportedVideoFormats = ['mp4', 'mov', 'avi'];
    }
    
    // Localization Configuration defaults
    if (!finalConfig.defaultLanguage) finalConfig.defaultLanguage = 'en';
    if (!finalConfig.supportedLanguages || !Array.isArray(finalConfig.supportedLanguages) || finalConfig.supportedLanguages.length === 0) {
      finalConfig.supportedLanguages = ['en', 'fr', 'es'];
    }
    
    // Currency Configuration defaults
    if (!finalConfig.defaultCurrency) finalConfig.defaultCurrency = 'USD';
    if (!finalConfig.supportedCurrencies || !Array.isArray(finalConfig.supportedCurrencies) || finalConfig.supportedCurrencies.length === 0) {
      finalConfig.supportedCurrencies = ['USD', 'EUR', 'GBP'];
    }
    
    // Transaction Configuration defaults
    if (!finalConfig.maxCoinsPerTransaction) finalConfig.maxCoinsPerTransaction = 10000;
    if (!finalConfig.minCoinsPerTransaction) finalConfig.minCoinsPerTransaction = 1;
    if (finalConfig.commissionRate === undefined || finalConfig.commissionRate === null) finalConfig.commissionRate = 0.1;
    
    // Feature Flags defaults
    if (finalConfig.paymentGatewayEnabled === undefined || finalConfig.paymentGatewayEnabled === null) finalConfig.paymentGatewayEnabled = true;
    if (finalConfig.notificationEnabled === undefined || finalConfig.notificationEnabled === null) finalConfig.notificationEnabled = true;
    if (finalConfig.analyticsEnabled === undefined || finalConfig.analyticsEnabled === null) finalConfig.analyticsEnabled = true;
    
    // Nested objects defaults
    if (!finalConfig.serviceLimits) finalConfig.serviceLimits = {
      liveShowDuration: 20,
      videoCallDuration: 5,
      slotDuration: 10,
      dedicationUploadSize: 20,
      maxLiveShowParticipants: 10000,
      reconnectionTimeout: 5
    };
    if (!finalConfig.idVerificationFees) finalConfig.idVerificationFees = {
      standardIdPrice: 0,
      goldIdPrice: 0
    };
    if (!finalConfig.liveShowFees) finalConfig.liveShowFees = {
      hostingFee: 0
    };
    if (!finalConfig.contactSupport) finalConfig.contactSupport = {
      companyServiceNumber: '+34895723487',
      supportEmail: 'support@playform.com',
      servicesTermsUrl: 'https://help.platform.com',
      privacyPolicyUrl: 'https://help.platform.com',
      helpdeskLink: 'https://help.platform.com'
    };
    if (!finalConfig.hideElementsPrice) finalConfig.hideElementsPrice = {
      hideDedications: false
    };
    if (finalConfig.adsInterval === undefined || finalConfig.adsInterval === null || Number(finalConfig.adsInterval) <= 0) {
      finalConfig.adsInterval = 3;
    }
    
    // Sanitize and return complete config
    const sanitized = sanitizeConfig(finalConfig);
    console.log('[UpdateGlobalConfig] Final config data:', JSON.stringify(sanitized, null, 2));
    
    return res.json({ 
      success: true, 
      message: 'Global configuration updated successfully',
      data: {
        config: sanitized
      }
    });
  } catch (err) {
    console.error('[UpdateGlobalConfig] Error:', err);
    return res.status(500).json({ 
      success: false, 
      message: err.message || 'Failed to update global configuration',
      error: err.stack 
    });
  }
};

// Category Management APIs (using existing Category model)
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: {
        categories: categories.map(cat => ({
          id: cat._id,
          name: cat.name,
          image: cat.image,
          createdAt: cat.createdAt,
          updatedAt: cat.updatedAt
        }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Country Service Configuration APIs
export const getCountryServiceConfigs = async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const countryConfigs = await CountryServiceConfig.find(filter)
      .sort({ sortOrder: 1, country: 1 });

    return res.json({
      success: true,
      message: 'Country service configurations retrieved successfully',
      data: {
        countryConfigs: countryConfigs.map(config => ({
          id: config._id,
          country: config.country,
          countryCode: config.countryCode,
          services: config.services,
          isActive: config.isActive,
          sortOrder: config.sortOrder,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createCountryServiceConfig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { country, countryCode, services, sortOrder } = req.body;

    const countryConfig = new CountryServiceConfig({
      country,
      countryCode,
      services: services || { videoCall: true, dedication: true, liveShow: true },
      sortOrder: sortOrder || 0
    });

    await countryConfig.save();

    return res.status(201).json({
      success: true,
      message: 'Country service configuration created successfully',
      data: {
        countryConfig: {
          id: countryConfig._id,
          country: countryConfig.country,
          countryCode: countryConfig.countryCode,
          services: countryConfig.services,
          isActive: countryConfig.isActive,
          sortOrder: countryConfig.sortOrder,
          createdAt: countryConfig.createdAt,
          updatedAt: countryConfig.updatedAt
        }
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Country service configuration already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateCountryServiceConfig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { configId } = req.params;
    const { country, countryCode, services, isActive, sortOrder } = req.body;

    const countryConfig = await CountryServiceConfig.findByIdAndUpdate(
      configId,
      { country, countryCode, services, isActive, sortOrder },
      { new: true, runValidators: true }
    );

    if (!countryConfig) {
      return res.status(404).json({ success: false, message: 'Country service configuration not found' });
    }

    return res.json({
      success: true,
      message: 'Country service configuration updated successfully',
      data: {
        countryConfig: {
          id: countryConfig._id,
          country: countryConfig.country,
          countryCode: countryConfig.countryCode,
          services: countryConfig.services,
          isActive: countryConfig.isActive,
          sortOrder: countryConfig.sortOrder,
          createdAt: countryConfig.createdAt,
          updatedAt: countryConfig.updatedAt
        }
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Country service configuration already exists' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCountryServiceConfig = async (req, res) => {
  try {
    const { configId } = req.params;

    const countryConfig = await CountryServiceConfig.findByIdAndDelete(configId);

    if (!countryConfig) {
      return res.status(404).json({ success: false, message: 'Country service configuration not found' });
    }

    return res.json({
      success: true,
      message: 'Country service configuration deleted successfully'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Legacy methods for backward compatibility
export const getPublicConfig = getGlobalConfig;
export const upsertConfig = updateGlobalConfig;



