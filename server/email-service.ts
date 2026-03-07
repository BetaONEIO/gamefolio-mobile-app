import * as brevo from '@getbrevo/brevo';
import { nanoid } from 'nanoid';
import * as fs from 'fs/promises';
import * as path from 'path';

if (!process.env.BREVO_API_KEY) {
  console.warn("BREVO_API_KEY not set - email functionality will be disabled");
}

const apiInstance = new brevo.TransactionalEmailsApi();
if (process.env.BREVO_API_KEY) {
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

const FROM_EMAIL = 'noreply@gamefolio.com';

// Export SITE_URL for use in other modules
export { SITE_URL };
// Separate URLs for different purposes
const SITE_URL = (() => {
  // Check for custom deployment URL first (production/staging) - for verification links
  if (process.env.SITE_URL) {
    return process.env.SITE_URL;
  }
  
  // Check for custom domain environment variable
  if (process.env.CUSTOM_DOMAIN) {
    return `https://${process.env.CUSTOM_DOMAIN}`;
  }
  
  // Check for Replit development environment
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // Check for Replit production deployment
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}--${process.env.REPL_OWNER}.replit.app`;
  }
  
  // Fallback for Replit without owner info
  if (process.env.REPL_SLUG) {
    return `https://${process.env.REPL_SLUG}.replit.app`;
  }
  
  // Check for Replit domains environment variable
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    return `https://${domains[0]}`;
  }
  
  // Local development fallback
  return 'http://localhost:5000';
})();

// Use reliable image hosting - always use Replit development domain for images
const IMAGE_BASE_URL = (() => {
  // ALWAYS prioritize the development domain for images - this is where static files are served
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // If development domain not available, try building the Replit app URL
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}--${process.env.REPL_OWNER}.replit.app`;
  }
  
  // Final fallback to SITE_URL (though images may not work)
  return SITE_URL;
})();



interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

async function loadTemplate(templateName: string, variables: Record<string, string> = {}): Promise<string> {
  try {
    const templatePath = path.join(process.cwd(), 'server', 'templates', 'emails', `${templateName}.html`);
    let template = await fs.readFile(templatePath, 'utf-8');
    
    // Replace template variables with actual values
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, value);
    });
    
    return template;
  } catch (error) {
    console.error(`Failed to load email template: ${templateName}`, error);
    throw new Error(`Email template "${templateName}" not found or could not be loaded`);
  }
}

async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) {
    console.log('Email sending disabled - BREVO_API_KEY not configured');
    console.log('Would send email:', params);
    return true; // Return true for development/testing
  }

  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: params.to }];
    sendSmtpEmail.sender = { email: FROM_EMAIL, name: 'Gamefolio' };
    sendSmtpEmail.subject = params.subject;
    sendSmtpEmail.htmlContent = params.html;

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully to:', params.to);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export class EmailService {
  static generateToken(): string {
    return nanoid(32);
  }

  static async sendVerificationEmail(email: string, code: string): Promise<boolean> {
    // Log verification code for debugging (first 2 digits only for security)
    console.log(`Email verification code sent (${process.env.NODE_ENV || 'development'}): ${code.substring(0, 2)}****`);
    console.log(`✅ Verification code email: Will be sent to ${email}`);
    
    try {
      const html = await loadTemplate('verification', {
        verificationCode: code,
        siteUrl: IMAGE_BASE_URL  // Use working domain for images
      });

      return await sendEmail({
        to: email,
        subject: 'Welcome to Gamefolio - Verify Your Email',
        html,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return false;
    }
  }

  static async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    // Always use the detected SITE_URL for the current environment
    // This ensures reset links work in development, Replit staging, and production
    const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
    
    // Log reset URL for all environments (helps with debugging)
    console.log(`Password reset URL (${process.env.NODE_ENV || 'development'}): ${resetUrl}`);
    console.log(`Base URL detected as: ${SITE_URL}`);
    console.log(`✅ Global URL system: Reset link will work in current environment`);
    
    try {
      const html = await loadTemplate('password-reset', {
        resetUrl,
        siteUrl: IMAGE_BASE_URL  // Use working domain for images
      });

      return await sendEmail({
        to: email,
        subject: 'Reset Your Gamefolio Password',
        html,
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return false;
    }
  }

  static async sendWelcomeEmail(email: string, username: string): Promise<boolean> {
    // Always use the detected SITE_URL for the current environment
    // This ensures welcome links work in development, Replit staging, and production
    const baseUrl = SITE_URL;
    
    try {
      const html = await loadTemplate('welcome', {
        username,
        baseUrl,
        siteUrl: IMAGE_BASE_URL  // Use working domain for images
      });

      return await sendEmail({
        to: email,
        subject: 'Welcome to Gamefolio - Your Gaming Journey Starts Now!',
        html,
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return false;
    }
  }

  static async sendContentReportEmail(reportData: {
    contentType: 'clip' | 'screenshot' | 'comment';
    contentId: number;
    contentTitle?: string;
    contentUrl?: string;
    reporterUsername: string;
    reporterEmail: string;
    reason: string;
    additionalMessage?: string;
    reportId: number;
  }): Promise<boolean> {
    const { contentType, contentId, contentTitle, contentUrl, reporterUsername, reporterEmail, reason, additionalMessage, reportId } = reportData;
    
    const supportEmail = 'support@gamefolio.com';
    const contentTypeLabel = contentType.charAt(0).toUpperCase() + contentType.slice(1);
    const reportTime = new Date().toLocaleString();
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Content Report - Gamefolio</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; background-color: #dc3545; color: white; padding: 20px; border-radius: 8px; }
            .logo { color: #ffffff; font-size: 24px; font-weight: bold; }
            .content { background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #ddd; }
            .report-details { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .content-preview { background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; }
            .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
            .urgent { color: #dc3545; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚨 Content Report Alert</div>
              <p style="margin: 10px 0 0 0;">Report ID: #${reportId}</p>
            </div>
            <div class="content">
              <h1 class="urgent">New Content Report Received</h1>
              <p>A user has reported ${contentType === 'comment' ? 'a comment' : `a ${contentType}`} that may violate community guidelines.</p>
              
              <div class="report-details">
                <h3>Report Details</h3>
                <p><strong>Content Type:</strong> ${contentTypeLabel}</p>
                <p><strong>Content ID:</strong> ${contentId}</p>
                ${contentTitle ? `<p><strong>Content Title:</strong> ${contentTitle}</p>` : ''}
                <p><strong>Reported By:</strong> ${reporterUsername} (${reporterEmail})</p>
                <p><strong>Report Time:</strong> ${reportTime}</p>
                <p><strong>Reason:</strong> ${reason}</p>
                ${additionalMessage ? `<p><strong>Additional Details:</strong><br>${additionalMessage}</p>` : ''}
              </div>

              ${contentUrl ? `
                <div class="content-preview">
                  <h4>Content Link</h4>
                  <p><a href="${contentUrl}" target="_blank">${contentUrl}</a></p>
                  <p><em>Click the link above to view the reported content directly.</em></p>
                </div>
              ` : ''}

              <div style="text-align: center; margin: 30px 0;">
                <a href="${SITE_URL}/admin" class="button">Review in Admin Panel</a>
                <a href="${contentUrl || `${SITE_URL}/${contentType}s/${contentId}`}" class="button" style="background-color: #28a745;">View Content</a>
              </div>

              <hr style="border: 1px solid #eee; margin: 20px 0;">
              
              <h3>Recommended Actions</h3>
              <ul>
                <li>Review the reported content for community guideline violations</li>
                <li>Check the reporter's history for validity</li>
                <li>Take appropriate moderation action if needed</li>
                <li>Update the report status in the admin panel</li>
              </ul>

              <p class="urgent">⚠️ This requires immediate attention from the moderation team.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from the Gamefolio content moderation system.</p>
              <p>Report generated at ${reportTime}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return await sendEmail({
      to: supportEmail,
      subject: `🚨 Content Report: ${contentTypeLabel} #${contentId} reported by ${reporterUsername}`,
      html,
    });
  }

  static async sendProWelcomeEmail(email: string, username: string, plan: 'monthly' | 'yearly'): Promise<boolean> {
    const planName = plan === 'monthly' ? 'Monthly' : 'Yearly';
    const renewalDate = plan === 'yearly'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    try {
      const html = await loadTemplate('pro-welcome', {
        username,
        planName,
        renewalDate,
        siteUrl: IMAGE_BASE_URL,
      });

      return await sendEmail({
        to: email,
        subject: 'Welcome to Gamefolio Pro - Your Premium Features Are Live!',
        html,
      });
    } catch (error) {
      console.error('Failed to send Pro welcome email:', error);
      return false;
    }
  }

  static async sendProCancelledEmail(email: string, username: string, endDate: Date): Promise<boolean> {
    const formattedEndDate = endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    try {
      const html = await loadTemplate('pro-cancelled', {
        username,
        endDate: formattedEndDate,
        siteUrl: IMAGE_BASE_URL,
      });

      return await sendEmail({
        to: email,
        subject: 'Your Gamefolio Pro Subscription Has Been Cancelled',
        html,
      });
    } catch (error) {
      console.error('Failed to send Pro cancelled email:', error);
      return false;
    }
  }

  static async sendPaymentFailedEmail(email: string, username: string): Promise<boolean> {
    try {
      const html = await loadTemplate('payment-failed', {
        username,
        siteUrl: IMAGE_BASE_URL,
      });

      return await sendEmail({
        to: email,
        subject: 'Action Required: Your Gamefolio Pro Payment Failed',
        html,
      });
    } catch (error) {
      console.error('Failed to send payment failed email:', error);
      return false;
    }
  }

  static async sendSubscriptionRenewedEmail(email: string, username: string, plan: 'monthly' | 'yearly', nextRenewalDate: string): Promise<boolean> {
    const planName = plan === 'monthly' ? 'Monthly' : 'Yearly';

    try {
      const html = await loadTemplate('pro-welcome', {
        username,
        planName,
        renewalDate: nextRenewalDate,
        siteUrl: IMAGE_BASE_URL,
      });

      return await sendEmail({
        to: email,
        subject: 'Your Gamefolio Pro Subscription Has Been Renewed!',
        html,
      });
    } catch (error) {
      console.error('Failed to send subscription renewed email:', error);
      return false;
    }
  }

  static async sendCancellationReasonToSupport(
    username: string,
    userEmail: string,
    reason: string,
    planType: string
  ): Promise<boolean> {
    const supportEmail = 'support@gamefolio.com';
    const cancellationTime = new Date().toLocaleString();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pro Subscription Cancellation - Gamefolio</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; background-color: #dc3545; color: white; padding: 20px; border-radius: 8px; }
            .logo { color: #ffffff; font-size: 24px; font-weight: bold; }
            .content { background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #ddd; }
            .details { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #555; display: inline-block; width: 140px; }
            .value { color: #333; }
            .reason-box { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Pro Subscription Cancelled</div>
              <p style="margin: 10px 0 0 0;">Gamefolio Support Notification</p>
            </div>
            <div class="content">
              <h2 style="color: #dc3545;">Cancellation Report</h2>
              <p>A Pro subscriber has cancelled their subscription. Details below:</p>

              <div class="details">
                <div class="detail-row">
                  <span class="label">Username:</span>
                  <span class="value">${username}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Email:</span>
                  <span class="value">${userEmail}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Plan:</span>
                  <span class="value">${planType}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Cancelled At:</span>
                  <span class="value">${cancellationTime}</span>
                </div>
              </div>

              <div class="reason-box">
                <h3 style="margin-top: 0; color: #856404;">Cancellation Reason</h3>
                <p style="margin-bottom: 0; font-size: 16px;">${reason}</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${SITE_URL}/admin" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Admin Panel</a>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from the Gamefolio subscription system.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      return await sendEmail({
        to: supportEmail,
        subject: `Pro Cancellation: ${username} - Reason: ${reason}`,
        html,
      });
    } catch (error) {
      console.error('Failed to send cancellation reason to support:', error);
      return false;
    }
  }

  static async sendNewUserNotification(userData: {
    username: string;
    email: string;
    displayName: string;
    authProvider?: string;
  }): Promise<boolean> {
    const { username, email, displayName, authProvider = 'local' } = userData;
    const notificationEmail = 'hello@gamefolio.com';
    const registrationTime = new Date().toLocaleString();
    const authMethod = authProvider === 'local' ? 'Email/Password' : authProvider.charAt(0).toUpperCase() + authProvider.slice(1);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New User Registration - Gamefolio</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; background-color: #4C8; color: white; padding: 20px; border-radius: 8px; }
            .logo { color: #ffffff; font-size: 24px; font-weight: bold; }
            .content { background-color: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #ddd; }
            .user-details { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
            .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #555; display: inline-block; width: 140px; }
            .value { color: #333; }
            .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎮 New User Registration</div>
              <p style="margin: 10px 0 0 0;">Gamefolio Platform</p>
            </div>
            <div class="content">
              <h1 style="color: #4C8;">New User Joined!</h1>
              <p>A new user has successfully registered on the Gamefolio platform.</p>
              
              <div class="user-details">
                <h3>User Information</h3>
                <div class="detail-row">
                  <span class="label">Username:</span>
                  <span class="value">${username}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Display Name:</span>
                  <span class="value">${displayName}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Email:</span>
                  <span class="value">${email}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Registration Method:</span>
                  <span class="value">${authMethod}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Registration Time:</span>
                  <span class="value">${registrationTime}</span>
                </div>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${SITE_URL}/${username}" class="button">View Profile</a>
                <a href="${SITE_URL}/admin" class="button" style="background-color: #28a745;">Admin Panel</a>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated notification from the Gamefolio registration system.</p>
              <p>Notification sent at ${registrationTime}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      return await sendEmail({
        to: notificationEmail,
        subject: `🎮 New User Registration: ${username} (${displayName})`,
        html,
      });
    } catch (error) {
      console.error('Failed to send new user notification:', error);
      return false;
    }
  }
}