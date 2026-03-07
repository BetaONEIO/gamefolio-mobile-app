import * as brevo from '@getbrevo/brevo';
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

// Determine the site URL based on environment
const SITE_URL = (() => {
  // Check for custom deployment URL first (production/staging)
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

// Use reliable image hosting - always use the development domain for images
const IMAGE_BASE_URL = (() => {
  // For production emails, use the production site URL where static files are served
  // This ensures images work in both dev and production
  return SITE_URL;
})();

async function loadTemplate(templateName: string, variables: Record<string, string>): Promise<string> {
  try {
    const templatePath = path.join(process.cwd(), 'server', 'templates', 'emails', `${templateName}.html`);
    let html = await fs.readFile(templatePath, 'utf-8');

    // Replace template variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value);
    }

    return html;
  } catch (error) {
    console.error(`Failed to load email template ${templateName}:`, error);
    throw error;
  }
}

interface EmailParams {
  to: string;
  subject: string;
  html: string;
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

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully to:', params.to);
    console.log('Brevo API response:', JSON.stringify(response?.body || response));
    return true;
  } catch (error: any) {
    console.error('Failed to send email:', error);
    console.error('Brevo error body:', JSON.stringify(error?.body || error?.response?.body || error?.message));
    return false;
  }
}

export class EmailService {
  static async sendVerificationEmail(email: string, code: string): Promise<boolean> {
    console.log(`📧 Sending verification email to: ${email} with code: ${code}`);
    console.log(`Base URL detected as: ${SITE_URL}`);
    console.log(`Image Base URL: ${IMAGE_BASE_URL}`);

    try {
      const html = await loadTemplate('verification', {
        verificationCode: code,
        siteUrl: SITE_URL
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

  static async sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
    console.log(`📧 sendPasswordResetEmail called for: ${email}`);
    console.log(`🌐 Base URL detected as: ${SITE_URL}`);
    console.log(`🔑 BREVO_API_KEY configured: ${!!process.env.BREVO_API_KEY}`);

    try {
      console.log('📄 Loading password-reset template...');
      const html = await loadTemplate('password-reset', {
        resetCode: code,
        siteUrl: SITE_URL
      });
      console.log('📄 Template loaded successfully');

      console.log('📬 Sending email...');
      const result = await sendEmail({
        to: email,
        subject: 'Reset Your Gamefolio Password',
        html,
      });
      console.log(`📬 Email sending result: ${result}`);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  static async sendWelcomeEmail(email: string, username: string): Promise<boolean> {
    const baseUrl = SITE_URL;

    console.log(`📧 sendWelcomeEmail called with email: ${email}, username: ${username}`);
    console.log(`📧 Welcome email base URL: ${baseUrl}`);
    console.log(`📧 Image Base URL: ${IMAGE_BASE_URL}`);
    console.log(`📧 BREVO_API_KEY configured: ${!!process.env.BREVO_API_KEY}`);

    try {
      console.log(`📧 Loading welcome email template...`);
      const html = await loadTemplate('welcome', {
        username,
        baseUrl,
        siteUrl: SITE_URL,
        imageUrl: `${IMAGE_BASE_URL}/api/static/email-assets/welcomeEmail.png`
      });

      console.log(`📧 Template loaded successfully, sending email...`);
      const result = await sendEmail({
        to: email,
        subject: 'Welcome to Gamefolio - Your Gaming Journey Starts Now!',
        html,
      });

      console.log(`📧 Email sending result: ${result}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
      return false;
    }
  }
}