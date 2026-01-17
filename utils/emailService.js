/**
 * Email Service
 * Handles sending emails using nodemailer
 * Supports multiple email providers (Gmail SMTP, SendGrid, Resend, etc.)
 */

import nodemailer from 'nodemailer'
import logger from './logger.js'

/**
 * Create email transporter based on environment variables
 * Supports Gmail SMTP, SendGrid, and other SMTP providers
 */
function createTransporter() {
  const emailProvider = process.env.EMAIL_PROVIDER || 'gmail' // 'gmail', 'sendgrid', 'smtp', 'resend'
  
  // Gmail SMTP (Free - requires app password)
  if (emailProvider === 'gmail') {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      logger.warn('Gmail credentials not configured. Email sending will be disabled.')
      return null
    }
    
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // App password, not regular password
      },
    })
  }
  
  // SendGrid SMTP
  if (emailProvider === 'sendgrid') {
    if (!process.env.SENDGRID_USER || !process.env.SENDGRID_API_KEY) {
      logger.warn('SendGrid credentials not configured. Email sending will be disabled.')
      return null
    }
    
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SENDGRID_USER, // Usually 'apikey'
        pass: process.env.SENDGRID_API_KEY,
      },
    })
  }
  
  // Resend SMTP
  if (emailProvider === 'resend') {
    if (!process.env.RESEND_API_KEY) {
      logger.warn('Resend API key not configured. Email sending will be disabled.')
      return null
    }
    
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    })
  }
  
  // Generic SMTP
  if (emailProvider === 'smtp') {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      logger.warn('SMTP credentials not configured. Email sending will be disabled.')
      return null
    }
    
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }
  
  logger.warn(`Unknown email provider: ${emailProvider}. Email sending will be disabled.`)
  return null
}

/**
 * Send password reset email
 * @param {string} toEmail - Recipient email address
 * @param {string} newPassword - New password to send
 * @param {string} recipientName - Recipient name (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendPasswordResetEmail(toEmail, newPassword, recipientName = null) {
  try {
    const transporter = createTransporter()
    
    if (!transporter) {
      logger.error('Email transporter not configured. Cannot send email.')
      return {
        success: false,
        error: 'Email service not configured. Please contact administrator.'
      }
    }
    
    const fromEmail = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@sportsevent.com'
    const fromName = process.env.EMAIL_FROM_NAME || 'Sports Event Management'
    const appName = process.env.APP_NAME || 'Sports Event Management System'
    
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      subject: 'Password Reset - Sports Event Management',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              border: 1px solid #ddd;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 20px;
              border-radius: 10px 10px 0 0;
              text-align: center;
              margin: -30px -30px 20px -30px;
            }
            .password-box {
              background-color: #fff;
              border: 2px solid #667eea;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              color: #667eea;
              letter-spacing: 2px;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${appName}</h1>
              <h2>Password Reset Request</h2>
            </div>
            
            <p>Hello ${recipientName || 'User'},</p>
            
            <p>You have requested to reset your password for your account. Your new temporary password is:</p>
            
            <div class="password-box">
              ${newPassword}
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> For security reasons, you will be required to change this password immediately after logging in.
            </div>
            
            <p>Please use this password to log in, and then change it to a password of your choice.</p>
            
            <p>If you did not request this password reset, please contact the administrator immediately.</p>
            
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset - ${appName}

Hello ${recipientName || 'User'},

You have requested to reset your password for your account. Your new temporary password is:

${newPassword}

IMPORTANT: For security reasons, you will be required to change this password immediately after logging in.

Please use this password to log in, and then change it to a password of your choice.

If you did not request this password reset, please contact the administrator immediately.

This is an automated email. Please do not reply to this message.

© ${new Date().getFullYear()} ${appName}. All rights reserved.
      `.trim(),
    }
    
    const info = await transporter.sendMail(mailOptions)
    
    logger.info(`Password reset email sent successfully to ${toEmail}. Message ID: ${info.messageId}`)
    
    return {
      success: true,
      messageId: info.messageId
    }
  } catch (error) {
    logger.error('Error sending password reset email:', error)
    return {
      success: false,
      error: error.message || 'Failed to send email. Please try again later.'
    }
  }
}

/**
 * Verify email transporter configuration
 * @returns {Promise<boolean>} True if email service is properly configured
 */
export async function verifyEmailConfiguration() {
  try {
    const transporter = createTransporter()
    
    if (!transporter) {
      return false
    }
    
    await transporter.verify()
    return true
  } catch (error) {
    logger.error('Email configuration verification failed:', error)
    return false
  }
}
