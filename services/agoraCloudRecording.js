import axios from 'axios';
import { recordingLog, RecordingSteps } from '../utils/recordingLogger.js';
import { GenerateRtcAgoraToken } from '../config/agora.js';

// Agora Cloud Recording API Configuration
const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID;
const AGORA_CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET;
// Recording UID must be an integer (not string) as per Agora documentation
const AGORA_RECORDING_UID = parseInt(process.env.AGORA_RECORDING_UID || '999999', 10); // Default recording UID (integer)
const AGORA_STORAGE_VENDOR = process.env.AGORA_STORAGE_VENDOR || 0; // 0 = Qiniu, 1 = AWS, 2 = Alibaba Cloud, 3 = Tencent Cloud, 4 = Kingsoft Cloud, 5 = Microsoft Azure, 6 = Google Cloud, 7 = Huawei Cloud
const AGORA_STORAGE_REGION = process.env.AGORA_STORAGE_REGION || 0;
const AGORA_STORAGE_BUCKET = process.env.AGORA_STORAGE_BUCKET || '';
const AGORA_STORAGE_ACCESS_KEY = process.env.AGORA_STORAGE_ACCESS_KEY || '';
const AGORA_STORAGE_SECRET_KEY = process.env.AGORA_STORAGE_SECRET_KEY || '';

const AGORA_API_BASE_URL = 'https://api.agora.io/v1/apps';

// Create Basic Auth header
const getAuthHeader = () => {
  const credentials = Buffer.from(`${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`).toString('base64');
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Acquire resource ID for cloud recording
 * @param {String} channelName - Agora channel name
 * @returns {Promise<Object>} Resource ID
 */
export const acquireResource = async (channelName) => {
  recordingLog(RecordingSteps.ACQUIRE_START, { channel: channelName }, 'acquire resource');
  try {
    console.log('[AgoraRecording] acquireResource env check:', {
      hasAppId: !!AGORA_APP_ID,
      hasCustomerId: !!AGORA_CUSTOMER_ID,
      hasCustomerSecret: !!AGORA_CUSTOMER_SECRET,
      appIdPreview: AGORA_APP_ID ? `${AGORA_APP_ID.substring(0, 4)}...${AGORA_APP_ID.substring(AGORA_APP_ID.length - 4)}` : null
    });
    if (!AGORA_APP_ID || !AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
      throw new Error('Agora credentials not configured');
    }

    const url = `${AGORA_API_BASE_URL}/${AGORA_APP_ID}/cloud_recording/acquire`;
    const payload = {
      cname: channelName,
      uid: String(AGORA_RECORDING_UID), // Agora API expects string but must be integer value
      clientRequest: {
        resourceExpiredHour: 24
      }
    };

    const response = await axios.post(url, payload, { headers: getAuthHeader() });
    
    if (response.data && response.data.resourceId) {
      const resourceId = response.data.resourceId;
      recordingLog(RecordingSteps.ACQUIRE_SUCCESS, { channel: channelName, resourceId }, 'resource acquired');
      console.log(`[AgoraRecording] Acquired resource ID: ${resourceId} for channel: ${channelName}`);
      return {
        success: true,
        resourceId
      };
    }

    throw new Error('Failed to acquire resource ID');
  } catch (error) {
    const errMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    recordingLog(RecordingSteps.ACQUIRE_FAIL, { channel: channelName }, errMsg);
    console.error('[AgoraRecording] Error acquiring resource:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};

/**
 * Start cloud recording
 * @param {String} resourceId - Resource ID from acquire
 * @param {String} channelName - Agora channel name
 * @param {String} mode - Recording mode: 'individual' or 'mix' (default: 'mix')
 * @returns {Promise<Object>} Recording session ID (sid)
 */
export const startRecording = async (resourceId, channelName, mode = 'mix') => {
  recordingLog(RecordingSteps.START_RECORDING_REQUEST, { channel: channelName, resourceId, mode }, 'start recording');
  try {
    if (!AGORA_APP_ID || !AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
      throw new Error('Agora credentials not configured');
    }

    if (!AGORA_STORAGE_BUCKET || !AGORA_STORAGE_ACCESS_KEY || !AGORA_STORAGE_SECRET_KEY) {
      throw new Error('Agora storage credentials not configured');
    }

    // Generate RTC token so the cloud recorder can join the secured channel
    const recordingToken = GenerateRtcAgoraToken(AGORA_RECORDING_UID, channelName);

    const url = `${AGORA_API_BASE_URL}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/mode/${mode}/start`;
    
    const payload = {
      cname: channelName,
      uid: String(AGORA_RECORDING_UID), // Agora API expects string but must be integer value (32-bit unsigned integer)
      clientRequest: {
        token: recordingToken,
        recordingConfig: {
          channelType: 0, // 0 = Communication, 1 = Live Broadcast
          streamTypes: 2, // 0 = Audio only, 1 = Video only, 2 = Audio and Video
          videoStreamType: 0, // 0 = Low stream, 1 = High stream
          // streamMode: "standard", // Removed as per documentation - standard creates MPD with WebM, without it creates M3U8 with TS
          maxIdleTime: 120, // Max idle time in seconds
          subscribeVideoUids: ["#allstream#"], // Record all video streams
          subscribeAudioUids: ["#allstream#"], // Record all audio streams
          subscribeUidGroup: 0
        },
        storageConfig: {
          vendor: parseInt(AGORA_STORAGE_VENDOR, 10),
          region: parseInt(AGORA_STORAGE_REGION, 10),
          bucket: AGORA_STORAGE_BUCKET,
          accessKey: AGORA_STORAGE_ACCESS_KEY,
          secretKey: AGORA_STORAGE_SECRET_KEY
        }
      }
    };

    const response = await axios.post(url, payload, { headers: getAuthHeader() });
    
    if (response.data && response.data.sid) {
      const sid = response.data.sid;
      recordingLog(RecordingSteps.START_SUCCESS, { channel: channelName, resourceId, sid, mode }, 'recording started');
      console.log(`[AgoraRecording] Started recording - SID: ${sid}, Resource ID: ${resourceId}, Channel: ${channelName}`);
      return {
        success: true,
        sid,
        resourceId: resourceId,
        serverResponse: response.data
      };
    }

    throw new Error('Failed to start recording');
  } catch (error) {
    const errMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    recordingLog(RecordingSteps.START_FAIL, { channel: channelName, resourceId }, errMsg);
    console.error('[AgoraRecording] Error starting recording:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};

/**
 * Stop cloud recording
 * @param {String} resourceId - Resource ID
 * @param {String} sid - Recording session ID
 * @param {String} channelName - Agora channel name
 * @param {String} mode - Recording mode: 'individual' or 'mix' (default: 'mix')
 * @returns {Promise<Object>} Recording file information
 */
export const stopRecording = async (resourceId, sid, channelName, mode = 'mix') => {
  recordingLog(RecordingSteps.STOP_REQUEST, { channel: channelName, resourceId, sid, mode }, 'stop recording');
  try {
    console.log(`[AgoraRecording] ===== STOP RECORDING REQUEST =====`);
    console.log(`[AgoraRecording] Resource ID: ${resourceId}`);
    console.log(`[AgoraRecording] SID: ${sid}`);
    console.log(`[AgoraRecording] Channel Name: ${channelName}`);
    console.log(`[AgoraRecording] Mode: ${mode}`);
    console.log(`[AgoraRecording] UID: ${String(AGORA_RECORDING_UID)}`);
    
    if (!AGORA_APP_ID || !AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
      throw new Error('Agora credentials not configured');
    }

    if (!resourceId || !sid || !channelName) {
      throw new Error(`Missing required parameters: resourceId=${resourceId}, sid=${sid}, channelName=${channelName}`);
    }

    const url = `${AGORA_API_BASE_URL}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${mode}/stop`;
    console.log(`[AgoraRecording] Stop URL: ${url}`);
    
    const payload = {
      cname: channelName,
      uid: String(AGORA_RECORDING_UID), // Agora API expects string but must be integer value
      clientRequest: {}
    };
    console.log(`[AgoraRecording] Stop Payload:`, JSON.stringify(payload, null, 2));

    const response = await axios.post(url, payload, { 
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json;charset=utf-8'
      }
    });
    
    if (response.data) {
      const responseCode = response.data.code;
      const responseReason = response.data.reason;
      
      // Check for "no recorded data" (code 435) - this is not an error, just means channel was empty
      const isNoData = responseCode === 435 || responseReason === 'no recorded data';
      
      if (isNoData) {
        recordingLog(RecordingSteps.STOP_NO_DATA, { channel: channelName, resourceId, sid }, 'no recorded data (channel empty)');
        console.log(`[AgoraRecording] ⚠️  STOP RECORDING - NO DATA RECORDED`);
        console.log(`[AgoraRecording] Response Status: ${response.status} (206 = Partial Content)`);
        console.log(`[AgoraRecording] Response Code: ${responseCode}`);
        console.log(`[AgoraRecording] Response Reason: ${responseReason}`);
        console.log(`[AgoraRecording] This means: Recording API worked, but channel was empty (no users in channel during recording)`);
        console.log(`[AgoraRecording] Possible reasons:`);
        console.log(`[AgoraRecording]   1. Users not in channel when recording was active`);
        console.log(`[AgoraRecording]   2. Channel name mismatch (users using different channel)`);
        console.log(`[AgoraRecording]   3. Recording started after users left`);
        console.log(`[AgoraRecording] Channel Name Used: ${channelName}`);
        console.log(`[AgoraRecording] ==========================================`);
      } else {
        recordingLog(RecordingSteps.STOP_SUCCESS, { channel: channelName, resourceId, sid, filesCount: (response.data.serverResponse?.fileList || response.data.fileList || []).length }, 'recording stopped');
        console.log(`[AgoraRecording] ✅ STOP RECORDING SUCCESS`);
        console.log(`[AgoraRecording] Response Status: ${response.status}`);
        console.log(`[AgoraRecording] Response Code: ${responseCode || 'none'}`);
      }
      
      console.log(`[AgoraRecording] Response Data:`, JSON.stringify(response.data, null, 2));
      
      // Agora response structure: response.data.serverResponse.fileList or response.data.fileList
      const fileList = response.data.serverResponse?.fileList || 
                       response.data.serverResponse?.file_list || 
                       response.data.fileList || 
                       response.data.file_list || 
                       [];
      
      console.log(`[AgoraRecording] Extracted File List:`, JSON.stringify(fileList, null, 2));
      console.log(`[AgoraRecording] Number of Files: ${Array.isArray(fileList) ? fileList.length : 0}`);
      console.log(`[AgoraRecording] ==========================================`);
      
      return {
        success: true,
        serverResponse: response.data,
        // Extract file information from response
        files: Array.isArray(fileList) ? fileList : [],
        uploadStatus: response.data.serverResponse?.uploadingStatus || 
                     response.data.serverResponse?.uploading_status || 
                     response.data.uploadingStatus || 
                     response.data.uploading_status || 
                     null,
        // Add flag for "no data" case
        noRecordedData: isNoData,
        message: isNoData ? 'Recording stopped successfully but no data was recorded (channel was empty)' : 'Recording stopped successfully'
      };
    }

    throw new Error('Failed to stop recording - no response data');
  } catch (error) {
    const errorData = error.response?.data || {};
    const errorCode = errorData.code || error.response?.status;
    const errorReason = errorData.reason || error.message;
    
    console.log(`[AgoraRecording] ===== STOP RECORDING ERROR =====`);
    console.log(`[AgoraRecording] Error Code: ${errorCode}`);
    console.log(`[AgoraRecording] Error Reason: ${errorReason}`);
    console.log(`[AgoraRecording] Full Error Data:`, JSON.stringify(errorData, null, 2));
    console.log(`[AgoraRecording] Request Parameters:`, {
      resourceId,
      sid,
      channelName,
      mode,
      url: `${AGORA_API_BASE_URL}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${mode}/stop`
    });
    
    // Handle 404 error - recording already stopped or session expired
    if (errorCode === 404 || errorReason?.includes('failed to find worker') || errorReason?.includes('not found')) {
      recordingLog(RecordingSteps.STOP_ALREADY_STOPPED, { channel: channelName, resourceId, sid }, '404 already stopped or expired');
      console.log(`[AgoraRecording] ⚠️  404 Error - Recording already stopped or session expired`);
      console.log(`[AgoraRecording] This is normal if recording was already stopped or session expired`);
      console.log(`[AgoraRecording] ==========================================`);
      // Return success with empty files - recording was already stopped
      return {
        success: true,
        alreadyStopped: true,
        message: 'Recording already stopped or session expired',
        files: [],
        serverResponse: null
      };
    }
    
    recordingLog(RecordingSteps.STOP_FAIL, { channel: channelName, resourceId, sid }, errorReason);
    console.error(`[AgoraRecording] ❌ FAILED TO STOP RECORDING`);
    console.error(`[AgoraRecording] Error:`, errorData || error.message);
    console.log(`[AgoraRecording] ==========================================`);
    return {
      success: false,
      error: errorData || error.message,
      errorCode: errorCode
    };
  }
};

/**
 * Query recording status
 * @param {String} resourceId - Resource ID
 * @param {String} sid - Recording session ID
 * @param {String} channelName - Agora channel name
 * @param {String} mode - Recording mode: 'individual' or 'mix' (default: 'mix')
 * @returns {Promise<Object>} Recording status
 */
export const queryRecording = async (resourceId, sid, channelName, mode = 'mix') => {
  try {
    if (!AGORA_APP_ID || !AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
      throw new Error('Agora credentials not configured');
    }

    const url = `${AGORA_API_BASE_URL}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${mode}/query`;
    
    const response = await axios.get(url, { headers: getAuthHeader() });
    
    if (response.data) {
      const status = response.data.serverResponse?.status || null;
      recordingLog(RecordingSteps.QUERY_RECORDING, { channel: channelName, resourceId, sid, status }, 'query ok');
      return {
        success: true,
        status,
        fileList: response.data.serverResponse?.fileList || [],
        serverResponse: response.data
      };
    }

    throw new Error('Failed to query recording');
  } catch (error) {
    recordingLog(RecordingSteps.QUERY_RECORDING, { channel: channelName, resourceId, sid }, (error.response?.data || error.message)?.toString?.() || String(error.message));
    console.error('[AgoraRecording] Error querying recording:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};

/**
 * Update recording layout (for mix mode)
 * @param {String} resourceId - Resource ID
 * @param {String} sid - Recording session ID
 * @param {String} channelName - Agora channel name
 * @param {Object} layoutConfig - Layout configuration
 * @param {String} mode - Recording mode: 'individual' or 'mix' (default: 'mix')
 * @returns {Promise<Object>} Update result
 */
export const updateLayout = async (resourceId, sid, channelName, layoutConfig = {}, mode = 'mix') => {
  try {
    if (!AGORA_APP_ID || !AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
      throw new Error('Agora credentials not configured');
    }

    const url = `${AGORA_API_BASE_URL}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${mode}/updateLayout`;
    
    const payload = {
      cname: channelName,
      uid: String(AGORA_RECORDING_UID), // Agora API expects string but must be integer value
      clientRequest: layoutConfig
    };

    const response = await axios.post(url, payload, { headers: getAuthHeader() });
    
    if (response.data) {
      console.log(`[AgoraRecording] Updated layout - SID: ${sid}, Resource ID: ${resourceId}`);
      return {
        success: true,
        serverResponse: response.data
      };
    }

    throw new Error('Failed to update layout');
  } catch (error) {
    console.error('[AgoraRecording] Error updating layout:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};

/**
 * Complete flow: Acquire resource and start recording
 * @param {String} channelName - Agora channel name
 * @param {String} mode - Recording mode: 'individual' or 'mix' (default: 'mix')
 * @returns {Promise<Object>} Recording information with resourceId and sid
 */
export const startRecordingForChannel = async (channelName, mode = 'mix') => {
  try {
    recordingLog(RecordingSteps.START_RECORDING_REQUEST, { channel: channelName, mode }, 'startRecordingForChannel begin');
    console.log(`[AgoraRecording] ===== START RECORDING FOR CHANNEL =====`);
    console.log(`[AgoraRecording] Channel Name: ${channelName}`);
    console.log(`[AgoraRecording] Mode: ${mode}`);
    
    // Step 1: Acquire resource
    console.log(`[AgoraRecording] Step 1: Acquiring resource...`);
    const acquireResult = await acquireResource(channelName);
    if (!acquireResult.success) {
      console.error(`[AgoraRecording] ❌ Failed to acquire resource:`, acquireResult.error);
      return acquireResult;
    }
    console.log(`[AgoraRecording] ✅ Resource acquired - Resource ID: ${acquireResult.resourceId}`);

    // Step 2: Start recording (must be within 5 minutes of acquiring resource)
    console.log(`[AgoraRecording] Step 2: Starting recording...`);
    const startResult = await startRecording(acquireResult.resourceId, channelName, mode);
    if (!startResult.success) {
      console.error(`[AgoraRecording] ❌ Failed to start recording:`, startResult.error);
      return startResult;
    }
    console.log(`[AgoraRecording] ✅ Recording started - SID: ${startResult.sid}`);

    const result = {
      success: true,
      resourceId: acquireResult.resourceId,
      sid: startResult.sid,
      channelName: channelName
    };
    
    recordingLog(RecordingSteps.START_SUCCESS, { channel: channelName, resourceId: result.resourceId, sid: result.sid }, 'startRecordingForChannel done');
    console.log(`[AgoraRecording] ✅ RECORDING STARTED SUCCESSFULLY`);
    console.log(`[AgoraRecording] Final Result:`, JSON.stringify(result, null, 2));
    console.log(`[AgoraRecording] ==========================================`);
    
    return result;
  } catch (error) {
    recordingLog(RecordingSteps.START_FAIL, { channel: channelName }, error.message);
    console.error(`[AgoraRecording] ❌ EXCEPTION IN startRecordingForChannel`);
    console.error(`[AgoraRecording] Error:`, error);
    console.error(`[AgoraRecording] Stack:`, error.stack);
    return {
      success: false,
      error: error.message
    };
  }
};

