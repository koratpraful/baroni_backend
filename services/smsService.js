import axios from 'axios';
import qs from 'qs';
import { removePlusPrefix } from '../utils/normalizeContact.js';

const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || 'http://35.242.129.85:8190/send-message';
const SMS_SENDER_NAME = process.env.SMS_SENDER_NAME || 'Baroni';

/**
 * Send SMS message
 * @param {string} phoneNumber - Recipient phone number (with or without + prefix)
 * @param {string} message - SMS message body
 * @returns {Promise<Object>} Response from SMS gateway
 */
export const sendSMS = async (phoneNumber, message) => {
  try {
    // Normalize phone number and remove + prefix for gateway
    const normalizedPhone = phoneNumber.trim();
    const numeroForGateway = removePlusPrefix(normalizedPhone);

    const form = {
      numero: numeroForGateway,
      corps: message,
      senderName: SMS_SENDER_NAME
    };

    const response = await axios.post(SMS_GATEWAY_URL, qs.stringify(form), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000 // 30 seconds timeout
    });

    return {
      success: true,
      messageId: response.data?.messageId || response.data?.id,
      gatewayStatus: response.status,
      gatewayData: response.data
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      success: false,
      error: error.message,
      gatewayError: error.response?.data || error.response?.statusText
    };
  }
};

/**
 * Send SMS to multiple recipients
 * @param {Array<string>} phoneNumbers - Array of recipient phone numbers
 * @param {string} message - SMS message body
 * @returns {Promise<Object>} Results with success and failure counts
 */
export const sendBulkSMS = async (phoneNumbers, message) => {
  const results = {
    successCount: 0,
    failureCount: 0,
    results: []
  };

  // Send SMS to each phone number
  for (const phoneNumber of phoneNumbers) {
    try {
      const result = await sendSMS(phoneNumber, message);
      if (result.success) {
        results.successCount++;
      } else {
        results.failureCount++;
      }
      results.results.push({
        phoneNumber,
        success: result.success,
        error: result.error
      });
    } catch (error) {
      results.failureCount++;
      results.results.push({
        phoneNumber,
        success: false,
        error: error.message
      });
    }
  }

  return results;
};
