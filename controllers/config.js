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
  
  // New fields
  serviceLimits: cfg.serviceLimits,
  idVerificationFees: cfg.idVerificationFees,
  liveShowFees: cfg.liveShowFees,
  contactSupport: cfg.contactSupport,
  hideElementsPrice: cfg.hideElementsPrice,
  hideApplyToBecomeStar: cfg.hideApplyToBecomeStar,
  
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
      // Create new config if none exists
      cfg = await Config.create({});
      console.log('[UpdateGlobalConfig] Created new config document');
    } else {
      console.log('[UpdateGlobalConfig] Found existing config document:', cfg._id);
    }

    const {
      liveShowPriceHide,
      videoCallPriceHide,
      becomeBaronistarPriceHide,
      isTestUser,
      serviceLimits,
      idVerificationFees,
      liveShowFees,
      contactSupport,
      hideElementsPrice,
      hideApplyToBecomeStar
    } = req.body;

    console.log('[UpdateGlobalConfig] Received update data:', JSON.stringify(req.body, null, 2));

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

    // Update nested objects - merge with existing values
    // Use markModified to ensure Mongoose detects changes in nested objects
    if (serviceLimits && typeof serviceLimits === 'object' && !Array.isArray(serviceLimits)) {
      // Merge individual fields from serviceLimits
      if (serviceLimits.liveShowDuration !== undefined) cfg.serviceLimits.liveShowDuration = serviceLimits.liveShowDuration;
      if (serviceLimits.videoCallDuration !== undefined) cfg.serviceLimits.videoCallDuration = serviceLimits.videoCallDuration;
      if (serviceLimits.slotDuration !== undefined) cfg.serviceLimits.slotDuration = serviceLimits.slotDuration;
      if (serviceLimits.dedicationUploadSize !== undefined) cfg.serviceLimits.dedicationUploadSize = serviceLimits.dedicationUploadSize;
      if (serviceLimits.maxLiveShowParticipants !== undefined) cfg.serviceLimits.maxLiveShowParticipants = serviceLimits.maxLiveShowParticipants;
      if (serviceLimits.reconnectionTimeout !== undefined) cfg.serviceLimits.reconnectionTimeout = serviceLimits.reconnectionTimeout;
      cfg.markModified('serviceLimits');
      console.log(`[UpdateGlobalConfig] Updated serviceLimits:`, cfg.serviceLimits);
    }
    
    if (idVerificationFees && typeof idVerificationFees === 'object' && !Array.isArray(idVerificationFees)) {
      if (idVerificationFees.standardIdPrice !== undefined) cfg.idVerificationFees.standardIdPrice = idVerificationFees.standardIdPrice;
      if (idVerificationFees.goldIdPrice !== undefined) cfg.idVerificationFees.goldIdPrice = idVerificationFees.goldIdPrice;
      cfg.markModified('idVerificationFees');
      console.log(`[UpdateGlobalConfig] Updated idVerificationFees:`, cfg.idVerificationFees);
    }
    
    if (liveShowFees && typeof liveShowFees === 'object' && !Array.isArray(liveShowFees)) {
      if (liveShowFees.hostingFee !== undefined) cfg.liveShowFees.hostingFee = liveShowFees.hostingFee;
      cfg.markModified('liveShowFees');
      console.log(`[UpdateGlobalConfig] Updated liveShowFees:`, cfg.liveShowFees);
    }
    
    if (contactSupport && typeof contactSupport === 'object' && !Array.isArray(contactSupport)) {
      if (contactSupport.companyServiceNumber !== undefined) cfg.contactSupport.companyServiceNumber = contactSupport.companyServiceNumber;
      if (contactSupport.supportEmail !== undefined) cfg.contactSupport.supportEmail = contactSupport.supportEmail;
      if (contactSupport.servicesTermsUrl !== undefined) cfg.contactSupport.servicesTermsUrl = contactSupport.servicesTermsUrl;
      if (contactSupport.privacyPolicyUrl !== undefined) cfg.contactSupport.privacyPolicyUrl = contactSupport.privacyPolicyUrl;
      if (contactSupport.helpdeskLink !== undefined) cfg.contactSupport.helpdeskLink = contactSupport.helpdeskLink;
      cfg.markModified('contactSupport');
      console.log(`[UpdateGlobalConfig] Updated contactSupport:`, cfg.contactSupport);
    }
    
    if (hideElementsPrice && typeof hideElementsPrice === 'object' && !Array.isArray(hideElementsPrice)) {
      if (hideElementsPrice.hideDedications !== undefined) {
        const normalized = normalize(hideElementsPrice.hideDedications);
        if (normalized !== undefined) {
          cfg.hideElementsPrice.hideDedications = normalized;
        }
      }
      cfg.markModified('hideElementsPrice');
      console.log(`[UpdateGlobalConfig] Updated hideElementsPrice:`, cfg.hideElementsPrice);
    }

    // Save the updated config
    const saved = await cfg.save();
    console.log('[UpdateGlobalConfig] Config saved successfully:', saved._id);
    console.log('[UpdateGlobalConfig] Saved config data:', JSON.stringify(sanitizeConfig(saved), null, 2));
    
    return res.json({ 
      success: true, 
      message: 'Global configuration updated successfully',
      data: {
        config: sanitizeConfig(saved)
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



