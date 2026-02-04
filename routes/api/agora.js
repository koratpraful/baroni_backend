import express from 'express';
import {
  AgoraRtcToken,
  AgoraRtmToken,
  testStartCloudRecording,
  testStopCloudRecording,
  testQueryCloudRecording
} from "../../controllers/agora.js";
import { requireAuth } from '../../middlewares/auth.js';

const router = express.Router();

// Token APIs used by app
router.post('/rtm-token', requireAuth, AgoraRtmToken);
router.post('/rtc-token', requireAuth, AgoraRtcToken);

// Cloud recording test APIs (admin-only inside controller)
router.post('/recording/test/start', requireAuth, testStartCloudRecording);
router.post('/recording/test/stop', requireAuth, testStopCloudRecording);
router.post('/recording/test/status', requireAuth, testQueryCloudRecording);

export default router;
