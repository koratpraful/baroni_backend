import nodemailer from 'nodemailer';

// Check if SMTP credentials are configured
const isSmtpConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

if (!isSmtpConfigured) {
  console.warn('[EMAIL SERVICE] SMTP credentials not configured. Email sending will fail.');
  console.warn('[EMAIL SERVICE] Please set EMAIL_USER and EMAIL_PASS environment variables.');
  console.warn('[EMAIL SERVICE] For Gmail, use App Password (not regular password).');
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: isSmtpConfigured ? {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  } : undefined,
});

export const sendResetEmail = async (to, token) => {
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:4000';
  const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.EMAIL_USER || 'no-reply@baroni.app',
    to,
    subject: 'Reset your Baroni password',
    html: `<p>Click the link below to reset your password.</p><p><a href="${resetUrl}">Reset Password</a></p>`
  });
  return info.messageId;
};

/**
 * Send general email notification
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body (HTML or plain text)
 * @param {boolean} isHtml - Whether body is HTML (default: true)
 * @returns {Promise<string>} Message ID
 */
export const sendEmail = async (to, subject, body, isHtml = true) => {
  // Check if SMTP is configured before attempting to send
  if (!isSmtpConfigured) {
    const error = new Error('SMTP credentials not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.EMAIL_USER || 'no-reply@baroni.app',
      to,
      subject: subject || 'Notification from Baroni',
      [isHtml ? 'html' : 'text']: body
    });
    console.log(`[EMAIL SERVICE] Email sent successfully to ${to}, messageId: ${info.messageId}`);
    return info.messageId;
  } catch (error) {
    // Provide more user-friendly error messages
    let errorMessage = error.message;
    
    if (error.responseCode === 530 || error.message?.includes('Authentication Required')) {
      errorMessage = 'SMTP authentication failed. Please check EMAIL_USER and EMAIL_PASS. For Gmail, use App Password.';
    } else if (error.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Invalid email or password.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to SMTP server. Please check SMTP_HOST and SMTP_PORT.';
    }
    
    console.error(`[EMAIL SERVICE] Error sending email to ${to}:`, {
      message: errorMessage,
      code: error.code,
      responseCode: error.responseCode,
      command: error.command
    });
    
    // Create a new error with user-friendly message
    const friendlyError = new Error(errorMessage);
    friendlyError.code = error.code;
    friendlyError.responseCode = error.responseCode;
    throw friendlyError;
  }
};


