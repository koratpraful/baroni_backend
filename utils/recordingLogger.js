/**
 * Recording-only file logger for Agora cloud recording flow.
 * Writes only recording-related events to logs/agora-recording.log so you can
 * trace: RTC token → notification → video call start → recording start/stop → call end.
 * No console noise – one file, one flow.
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'agora-recording.log');

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (_) {}
}

/**
 * Write one line to the recording log file. All args are optional; only non-empty are added.
 * @param {string} step - Short step name (e.g. RTC_TOKEN_REQUEST, ACQUIRE_START, RECORDING_STOPPED)
 * @param {Object} ctx - { appointmentId, channel, resourceId, sid, userId, ... }
 * @param {string} message - Optional human-readable message
 */
export function recordingLog(step, ctx = {}, message = '') {
  try {
    ensureLogDir();
    const ts = new Date().toISOString();
    const parts = [ts, step];
    if (ctx && typeof ctx === 'object') {
      const safe = {};
      for (const [k, v] of Object.entries(ctx)) {
        if (v !== undefined && v !== null && v !== '') safe[k] = v;
      }
      if (Object.keys(safe).length) parts.push(JSON.stringify(safe));
    }
    if (message && String(message).trim()) parts.push(String(message).trim());
    const line = parts.join(' ') + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) {
    // Don't throw – logging must not break the app
    try {
      console.error('[RecordingLogger] Failed to write log:', e.message);
    } catch (_) {}
  }
}

/**
 * Helpers for consistent step names and context.
 */
export const RecordingSteps = {
  // RTC token flow
  RTC_TOKEN_REQUEST: 'RTC_TOKEN_REQUEST',
  RTC_TOKEN_GENERATED: 'RTC_TOKEN_GENERATED',
  RTC_TOKEN_ERROR: 'RTC_TOKEN_ERROR',
  // Recording decision (on token request)
  RECORDING_START_REQUESTED: 'RECORDING_START_REQUESTED',
  RECORDING_SKIPPED: 'RECORDING_SKIPPED',
  RECORDING_STARTED_FROM_TOKEN: 'RECORDING_STARTED_FROM_TOKEN',
  RECORDING_FAILED_FROM_TOKEN: 'RECORDING_FAILED_FROM_TOKEN',
  // Acquire
  ACQUIRE_START: 'ACQUIRE_START',
  ACQUIRE_SUCCESS: 'ACQUIRE_SUCCESS',
  ACQUIRE_FAIL: 'ACQUIRE_FAIL',
  // Start
  START_RECORDING_REQUEST: 'START_RECORDING_REQUEST',
  START_SUCCESS: 'START_SUCCESS',
  START_FAIL: 'START_FAIL',
  // Stop
  STOP_REQUEST: 'STOP_REQUEST',
  STOP_SUCCESS: 'STOP_SUCCESS',
  STOP_FAIL: 'STOP_FAIL',
  STOP_NO_DATA: 'STOP_NO_DATA',
  STOP_ALREADY_STOPPED: 'STOP_ALREADY_STOPPED',
  // Call duration / appointment flow
  REPORT_DURATION: 'REPORT_DURATION',
  RECORDING_LOGIC_CALL_START: 'RECORDING_LOGIC_CALL_START',
  RECORDING_LOGIC_CALL_END: 'RECORDING_LOGIC_CALL_END',
  RECORDING_START_VIA_DURATION: 'RECORDING_START_VIA_DURATION',
  RECORDING_STOP_VIA_END_CALL: 'RECORDING_STOP_VIA_END_CALL',
  RECORDING_STOP_ON_CANCEL: 'RECORDING_STOP_ON_CANCEL',
  // Query
  QUERY_RECORDING: 'QUERY_RECORDING',
};

export default { recordingLog, RecordingSteps };
