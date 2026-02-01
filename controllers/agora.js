import {GenerateRtcAgoraToken, GenerateRtmAgoraToken} from "../config/agora.js";
import { ensureUserAgoraKey } from "../utils/agoraKeyGenerator.js";

export const AgoraRtmToken = async (req,res) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        
        const agoraKey = await ensureUserAgoraKey(req.user);
        // RTM requires a string userAccount, not a numeric uid
        const userAccount = String(agoraKey);

        const token = GenerateRtmAgoraToken(userAccount);
        console.log(`[Agora] RTM token account=${userAccount}`);
        res.json({ token });
    } catch (error) {
        console.error('[Agora] RTM token error:', error.message);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const AgoraRtcToken = async (req,res) => {
    try {
        const { channel } = req.body;
        
        if (!req.user) return res.status(401).json({ error: "Unauthorized" });
        if (!channel) return res.status(400).json({ error: "Channel is required" });

        const agoraKey = await ensureUserAgoraKey(req.user);
        const uid = Number(agoraKey);

        // RTC token only – cloud recording starts in completeAppointment on first duration (call start)
        const token = GenerateRtcAgoraToken(uid, channel);
        console.log(`[Agora] RTC token channel=${channel} uid=${uid} (cloud recording on first duration)`);
        
        res.json({ token });
    } catch (error) {
        console.error('[Agora] RTC token error:', error.message);
        res.status(500).json({ error: "Internal server error" });
    }
}
