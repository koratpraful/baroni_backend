import { validationResult, body, param } from 'express-validator';
import CommissionConfig from '../models/CommissionConfig.js';

export const getCommissionConfig = async (req, res) => {
  try {
    const cfg = await CommissionConfig.getSingleton();
    
    // Format response to match UI requirements - convert to percentage with 2 decimal precision
    return res.json({ 
      success: true, 
      data: {
        globalDefault: cfg.globalDefault !== undefined && cfg.globalDefault !== null
          ? Math.round(cfg.globalDefault * 10000) / 100  // Round to 2 decimal places
          : 15,
        serviceDefaults: {
          videoCall: cfg.serviceDefaults?.videoCall !== undefined && cfg.serviceDefaults.videoCall !== null
            ? Math.round(cfg.serviceDefaults.videoCall * 10000) / 100
            : 16,
          liveShow: cfg.serviceDefaults?.liveShow !== undefined && cfg.serviceDefaults.liveShow !== null
            ? Math.round(cfg.serviceDefaults.liveShow * 10000) / 100
            : 16,
          dedication: cfg.serviceDefaults?.dedication !== undefined && cfg.serviceDefaults.dedication !== null
            ? Math.round(cfg.serviceDefaults.dedication * 10000) / 100
            : 16
        },
        countryOverrides: (cfg.countryOverrides || []).map(override => ({
          country: override.country,
          countryCode: override.countryCode,
          rates: {
            videoCall: override.rates?.videoCall !== undefined && override.rates.videoCall !== null
              ? Math.round(override.rates.videoCall * 10000) / 100
              : null,
            liveShow: override.rates?.liveShow !== undefined && override.rates.liveShow !== null
              ? Math.round(override.rates.liveShow * 10000) / 100
              : null,
            dedication: override.rates?.dedication !== undefined && override.rates.dedication !== null
              ? Math.round(override.rates.dedication * 10000) / 100
              : null
          }
        })),
        updatedAt: cfg.updatedAt,
        updatedBy: cfg.updatedBy
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateGlobalCommission = async (req, res) => {
  try {
    const { globalDefault } = req.body;
    const inputValue = typeof globalDefault === 'number' ? globalDefault : Number(globalDefault);
    
    if (isNaN(inputValue) || inputValue < 0) {
      return res.status(400).json({ success: false, message: 'globalDefault must be >= 0' });
    }
    
    // Accept both decimal (0-1) and percentage (0-100) formats
    let decimalValue;
    if (inputValue > 1) {
      // Percentage format (e.g., 20 for 20%)
      if (inputValue > 100) {
        return res.status(400).json({ success: false, message: 'globalDefault must be 0-100 if percentage, or 0-1 if decimal' });
      }
      decimalValue = inputValue / 100; // Convert percentage to decimal
    } else {
      // Decimal format (e.g., 0.20 for 20%)
      decimalValue = inputValue;
    }
    
    // Ensure value is within valid range (0-1)
    if (decimalValue > 1) {
      return res.status(400).json({ success: false, message: 'globalDefault must be 0-1 as decimal or 0-100 as percentage' });
    }
    
    const cfg = await CommissionConfig.getSingleton();
    cfg.globalDefault = decimalValue;
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    
    // Return formatted response - convert back to percentage with 2 decimal precision
    return res.json({ 
      success: true, 
      data: { 
        globalDefault: Math.round(decimalValue * 10000) / 100  // Round to 2 decimal places
      } 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateServiceDefaults = async (req, res) => {
  try {
    const { serviceDefaults } = req.body;
    const allowed = ['videoCall', 'liveShow', 'dedication'];
    if (!serviceDefaults || typeof serviceDefaults !== 'object') {
      return res.status(400).json({ success: false, message: 'serviceDefaults required' });
    }
    const cfg = await CommissionConfig.getSingleton();
    const currentDefaults = cfg.serviceDefaults?.toObject?.() || cfg.serviceDefaults || {};
    const updatedDefaults = { ...currentDefaults };
    
    // Convert values to decimals - accept both decimal (0-1) and percentage (0-100) formats
    for (const key of Object.keys(serviceDefaults)) {
      if (!allowed.includes(key)) {
        return res.status(400).json({ success: false, message: `Invalid key ${key}` });
      }
      
      const inputValue = Number(serviceDefaults[key]);
      if (Number.isNaN(inputValue) || inputValue < 0) {
        return res.status(400).json({ success: false, message: `Invalid rate for ${key} (must be >= 0)` });
      }
      
      // If value is > 1, treat as percentage (0-100), otherwise treat as decimal (0-1)
      let decimalValue;
      if (inputValue > 1) {
        // Percentage format (e.g., 17 for 17%)
        if (inputValue > 100) {
          return res.status(400).json({ success: false, message: `Invalid rate for ${key} (must be 0-100 if percentage, or 0-1 if decimal)` });
        }
        decimalValue = inputValue / 100; // Convert percentage to decimal
      } else {
        // Decimal format (e.g., 0.17 for 17%)
        decimalValue = inputValue;
      }
      
      // Ensure value is within valid range (0-1)
      if (decimalValue > 1) {
        return res.status(400).json({ success: false, message: `Invalid rate for ${key} (must be 0-1 as decimal or 0-100 as percentage)` });
      }
      
      updatedDefaults[key] = decimalValue;
    }
    
    cfg.serviceDefaults = updatedDefaults;
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    
    // Return formatted response - convert back to percentage with 2 decimal precision
    return res.json({ 
      success: true, 
      data: {
        serviceDefaults: {
          videoCall: cfg.serviceDefaults.videoCall !== undefined && cfg.serviceDefaults.videoCall !== null
            ? Math.round((cfg.serviceDefaults.videoCall || 0) * 10000) / 100
            : null,
          liveShow: cfg.serviceDefaults.liveShow !== undefined && cfg.serviceDefaults.liveShow !== null
            ? Math.round((cfg.serviceDefaults.liveShow || 0) * 10000) / 100
            : null,
          dedication: cfg.serviceDefaults.dedication !== undefined && cfg.serviceDefaults.dedication !== null
            ? Math.round((cfg.serviceDefaults.dedication || 0) * 10000) / 100
            : null
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Helper function to convert rates to decimal format
const convertRatesToDecimal = (rates, allowed) => {
  const convertedRates = {};
  for (const k of allowed) {
    if (rates[k] !== undefined) {
      const inputValue = Number(rates[k]);
      if (Number.isNaN(inputValue) || inputValue < 0) {
        throw new Error(`Invalid rate for ${k} (must be >= 0)`);
      }
      
      // If value is > 1, treat as percentage (0-100), otherwise treat as decimal (0-1)
      let decimalValue;
      if (inputValue > 1) {
        // Percentage format (e.g., 17 for 17%)
        if (inputValue > 100) {
          throw new Error(`Invalid rate for ${k} (must be 0-100 if percentage, or 0-1 if decimal)`);
        }
        decimalValue = inputValue / 100; // Convert percentage to decimal
      } else {
        // Decimal format (e.g., 0.17 for 17%)
        decimalValue = inputValue;
      }
      
      // Ensure value is within valid range (0-1)
      if (decimalValue > 1) {
        throw new Error(`Invalid rate for ${k} (must be 0-1 as decimal or 0-100 as percentage)`);
      }
      
      convertedRates[k] = decimalValue;
    }
  }
  return convertedRates;
};

// Helper function to format rates for response
const formatRatesForResponse = (rates) => {
  return {
    videoCall: rates?.videoCall !== undefined && rates.videoCall !== null 
      ? Math.round(rates.videoCall * 10000) / 100  // Round to 2 decimal places
      : null,
    liveShow: rates?.liveShow !== undefined && rates.liveShow !== null
      ? Math.round(rates.liveShow * 10000) / 100
      : null,
    dedication: rates?.dedication !== undefined && rates.dedication !== null
      ? Math.round(rates.dedication * 10000) / 100
      : null
  };
};

export const upsertCountryOverride = async (req, res) => {
  try {
    const allowed = ['videoCall', 'liveShow', 'dedication'];
    const cfg = await CommissionConfig.getSingleton();
    const list = cfg.countryOverrides || [];
    
    // Check if request body is an array (multiple countries) or single object
    const countriesToProcess = Array.isArray(req.body) ? req.body : [req.body];
    
    if (countriesToProcess.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one country override is required' });
    }
    
    const processedCountries = [];
    const errors = [];
    
    // Process each country
    for (let i = 0; i < countriesToProcess.length; i++) {
      const countryData = countriesToProcess[i];
      const { country, countryCode, rates } = countryData;
      
      if (!country || !countryCode || !rates) {
        errors.push(`Country ${i + 1}: country, countryCode and rates are required`);
        continue;
      }
      
      const norm = String(countryCode).toUpperCase();
      
      try {
        // Convert values to decimals - accept both decimal (0-1) and percentage (0-100) formats
        const convertedRates = convertRatesToDecimal(rates, allowed);
        
        // Find existing override for this country
        const idx = list.findIndex((c) => c.countryCode === norm);
        
        const mergedRates = idx >= 0 
          ? { ...list[idx].rates?.toObject?.() || list[idx].rates, ...convertedRates } 
          : convertedRates;
        
        if (idx >= 0) {
          // Update existing override
          list[idx] = { 
            country: country || list[idx].country, 
            countryCode: norm, 
            rates: mergedRates 
          };
        } else {
          // Add new override
          list.push({ country, countryCode: norm, rates: mergedRates });
        }
        
        processedCountries.push({
          country: country || list[idx]?.country,
          countryCode: norm,
          rates: formatRatesForResponse(mergedRates)
        });
      } catch (rateError) {
        errors.push(`Country ${i + 1} (${countryCode}): ${rateError.message}`);
      }
    }
    
    if (errors.length > 0 && processedCountries.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Failed to process countries',
        errors 
      });
    }
    
    // Save all changes
    cfg.countryOverrides = list;
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    
    // Return response
    // If single country was processed, return single object (backward compatibility)
    // If multiple countries, return array
    if (countriesToProcess.length === 1 && processedCountries.length === 1) {
      return res.status(processedCountries[0] ? 200 : 201).json({ 
        success: true, 
        data: processedCountries[0],
        ...(errors.length > 0 && { warnings: errors })
      });
    } else {
      return res.status(200).json({ 
        success: true, 
        data: processedCountries,
        ...(errors.length > 0 && { warnings: errors })
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCountryOverride = async (req, res) => {
  try {
    const code = String(req.params.countryCode || '').toUpperCase();
    const cfg = await CommissionConfig.getSingleton();
    const before = cfg.countryOverrides?.length || 0;
    cfg.countryOverrides = (cfg.countryOverrides || []).filter((c) => c.countryCode !== code);
    if ((cfg.countryOverrides?.length || 0) === before) {
      return res.status(404).json({ success: false, message: 'Override not found' });
    }
    cfg.updatedBy = req.user?._id;
    await cfg.save();
    return res.json({ success: true, data: cfg });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};


