import dotenv from 'dotenv';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  try {
    // Ensure .env is loaded BEFORE loading Agora recording service,
    // so process.env values are available when the module reads them.
    dotenv.config();
    const { startRecordingForChannel, stopRecording } = await import('../services/agoraCloudRecording.js');

    console.log('=== Agora Cloud Recording TEST ===');

    const defaultChannel = process.argv[2] || process.env.TEST_AGORA_CHANNEL || '';
    const channelName = (await question(`Channel name to record (e.g. appointment_<appointmentId>) [${defaultChannel || 'required'}]: `)).trim() || defaultChannel;

    if (!channelName) {
      console.error('Channel name is required. Pass it as CLI arg or TEST_AGORA_CHANNEL env.');
      process.exit(1);
    }

    const idleSecondsInput = (await question('How many seconds to wait before stopping recording? [30]: ')).trim();
    const idleSeconds = idleSecondsInput ? Number(idleSecondsInput) : 30;

    console.log('\nStep 1: Starting recording...');
    const startResult = await startRecordingForChannel(channelName, 'mix');

    if (!startResult.success || !startResult.resourceId || !startResult.sid) {
      console.error('❌ Failed to start recording.');
      console.error(startResult.error || startResult);
      process.exit(1);
    }

    const { resourceId, sid } = startResult;
    console.log('✅ Recording started.');
    console.log(`Resource ID: ${resourceId}`);
    console.log(`SID        : ${sid}`);

    console.log(`\nNow JOIN this channel from your app/web with the SAME channel name: ${channelName}`);
    console.log(`Waiting ${idleSeconds} seconds so you can place a real test call...`);
    await new Promise((resolve) => setTimeout(resolve, idleSeconds * 1000));

    console.log('\nStep 2: Stopping recording...');
    const stopResult = await stopRecording(resourceId, sid, channelName, 'mix');

    if (!stopResult.success) {
      console.error('❌ Failed to stop recording.');
      console.error(stopResult.error || stopResult);
      process.exit(1);
    }

    console.log('✅ Recording stopped.');
    console.log('Upload status:', stopResult.uploadStatus || 'N/A');
    console.log('No recorded data:', !!stopResult.noRecordedData);

    const files = Array.isArray(stopResult.files) ? stopResult.files : [];
    console.log(`\nFiles returned from Agora (${files.length}):`);
    files.forEach((f, idx) => {
      console.log(`  [${idx + 1}] fileName=${f.fileName}, trackType=${f.trackType}, uid=${f.uid || ''}`);
    });

    const publicBaseUrl = process.env.AGORA_STORAGE_PUBLIC_BASE_URL || null;
    if (publicBaseUrl && files.length > 0) {
      console.log('\nPublic URLs (if your bucket/object is public):');
      const base = publicBaseUrl.replace(/\/$/, '');
      files.forEach((f, idx) => {
        console.log(`  [${idx + 1}] ${base}/${f.fileName}`);
      });
    } else {
      console.log('\nTip: set AGORA_STORAGE_PUBLIC_BASE_URL in .env (e.g. https://your-bucket.s3.your-region.amazonaws.com)');
      console.log('Then re-run this script to get direct clickable URLs for the recorded files.');
    }

    console.log('\n=== TEST FINISHED ===');
    rl.close();
  } catch (err) {
    console.error('Unexpected error in testAgoraRecording:', err);
    rl.close();
    process.exit(1);
  }
}

main();

