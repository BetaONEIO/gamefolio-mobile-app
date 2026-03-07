import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { EmailService } from '../email-service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabaseStorage } from '../supabase-storage';

const router = Router();

// Configure multer for support attachments
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const supportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'support-' + uniqueId + path.extname(file.originalname));
  }
});

const supportUpload = multer({
  storage: supportStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for support attachments
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for support attachments'));
    }
  }
});

// Support form submission schema
const supportFormSchema = z.object({
  username: z.string().optional(),
  email: z.string().email().optional(),
  category: z.enum(['Tech Support', 'Business Enquiry', 'Partnership Enquiry', 'Other']),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters long'),
  attachmentUrls: z.array(z.string()).optional() // Array of screenshot URLs
});

// Upload support attachments
router.post('/upload-attachments', supportUpload.array('attachments', 5), async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No attachment files provided' });
    }

    const uploadedUrls: string[] = [];

    for (const file of req.files) {
      try {
        // Read the uploaded file
        const fileBuffer = fs.readFileSync(file.path);

        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.round(Math.random() * 1E9);
        const fileName = `support-attachments/${timestamp}-${randomId}${path.extname(file.originalname)}`;

        // Upload to Supabase
        const uploadResult = await supabaseStorage.uploadBuffer(
          fileBuffer,
          fileName,
          file.mimetype,
          'image',
          0 // Use 0 for support attachments (no specific user)
        );

        uploadedUrls.push(uploadResult.url);

        // Clean up temp file
        fs.unlink(file.path, (err) => {
          if (err) console.warn('Could not delete temp support file:', err);
        });

      } catch (error) {
        console.error('Error uploading support attachment:', error);
        // Clean up temp file on error
        fs.unlink(file.path, (err) => {
          if (err) console.warn('Could not delete temp support file:', err);
        });
      }
    }

    res.json({
      success: true,
      attachmentUrls: uploadedUrls,
      message: `${uploadedUrls.length} attachment(s) uploaded successfully`
    });

  } catch (error) {
    console.error('Support attachment upload error:', error);

    // Clean up temp files on error
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file) => {
        fs.unlink(file.path, (err) => {
          if (err) console.warn('Could not delete temp support file:', err);
        });
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : 'Attachment upload failed'
    });
  }
});

// Submit support form
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = supportFormSchema.parse(req.body);
    
    const categoryLabels = {
      'Tech Support': 'Tech Support',
      'Business Enquiry': 'Business Enquiry',
      'Partnership Enquiry': 'Partnership Enquiry',
      'Other': 'Other'
    };

    // Generate email HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Gamefolio Support Request</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f9fafb; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #4ADE80 0%, #22C55E 100%); color: white; padding: 30px 40px; text-align: center; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .content { padding: 40px; }
            .support-details { background-color: #f3f4f6; border-radius: 6px; padding: 20px; margin: 20px 0; }
            .support-details h3 { margin-top: 0; margin-bottom: 15px; color: #1f2937; }
            .support-details p { margin: 8px 0; line-height: 1.5; }
            .category-badge { display: inline-block; background-color: #4ADE80; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 15px; }
            .message-content { background-color: #fff; border: 2px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0; white-space: pre-wrap; line-height: 1.6; }
            .footer { background-color: #f9fafb; padding: 20px 40px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
            .urgent { color: #dc2626; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🎮 Gamefolio Support</div>
              <p style="margin: 10px 0 0 0;">New support request received</p>
            </div>
            <div class="content">
              <div class="category-badge">${categoryLabels[validatedData.category]}</div>
              
              <h1>Support Request Details</h1>
              
              <div class="support-details">
                <h3>Request Information</h3>
                ${validatedData.username ? `<p><strong>Username:</strong> ${validatedData.username}</p>` : '<p><strong>Username:</strong> Not provided</p>'}
                ${validatedData.email ? `<p><strong>Email:</strong> ${validatedData.email}</p>` : '<p><strong>Email:</strong> Not provided</p>'}
                <p><strong>Category:</strong> ${categoryLabels[validatedData.category]}</p>
                <p><strong>Subject:</strong> ${validatedData.subject}</p>
                <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <h3>Message:</h3>
              <div class="message-content">${validatedData.message}</div>

              ${validatedData.attachmentUrls && validatedData.attachmentUrls.length > 0 ? `
              <h3>Attachments:</h3>
              <div style="margin: 20px 0;">
                ${validatedData.attachmentUrls.map((url, index) => `
                  <div style="margin-bottom: 15px; padding: 10px; background-color: #f3f4f6; border-radius: 6px;">
                    <p><strong>Screenshot ${index + 1}:</strong></p>
                    <img src="${url}" alt="Support Screenshot ${index + 1}" style="max-width: 100%; height: auto; border-radius: 6px; margin-top: 10px;" />
                    <p style="font-size: 12px; color: #6b7280; margin-top: 5px;"><a href="${url}" target="_blank">View Full Size</a></p>
                  </div>
                `).join('')}
              </div>
              ` : ''}

              <div style="margin-top: 30px; padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
                <p style="margin: 0;"><strong>🔔 Action Required:</strong> Please respond to this support request promptly via your support system.</p>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from the Gamefolio support system.</p>
              <p>Support request submitted at ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email to support team using the private sendEmail function
    // We need to call the private sendEmail function directly
    const sendEmail = async (params: { to: string; subject: string; html: string }): Promise<boolean> => {
      if (!process.env.BREVO_API_KEY) {
        console.log('Email sending disabled - BREVO_API_KEY not configured');
        console.log('Would send email:', params);
        return true;
      }

      try {
        const apiInstance = new (await import('@getbrevo/brevo')).TransactionalEmailsApi();
        apiInstance.setApiKey((await import('@getbrevo/brevo')).TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
        
        const sendSmtpEmail = new (await import('@getbrevo/brevo')).SendSmtpEmail();
        sendSmtpEmail.to = [{ email: params.to }];
        sendSmtpEmail.sender = { email: 'noreply@gamefolio.com', name: 'Gamefolio' };
        sendSmtpEmail.subject = params.subject;
        sendSmtpEmail.htmlContent = params.html;

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('Email sent successfully to:', params.to);
        return true;
      } catch (error) {
        console.error('Failed to send email:', error);
        return false;
      }
    };

    const emailSent = await sendEmail({
      to: 'support@gamefolio.com',
      subject: `🎮 Gamefolio Support: ${categoryLabels[validatedData.category]} - ${validatedData.subject}`,
      html
    });

    if (emailSent) {
      res.json({ success: true, message: 'Support request sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send support request' });
    }

  } catch (error) {
    console.error('Support form error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid form data', 
        errors: error.errors 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while processing your support request' 
    });
  }
});

export default router;