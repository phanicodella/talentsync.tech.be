// backend/src/services/email.service.js
const nodemailer = require('nodemailer');
const config = require('../config/env.config');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // Send generic email
    async sendEmail(to, subject, body, html = null) {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM || 'noreply@talentsync.com',
                to,
                subject,
                text: body,
                html: html || body
            };

            return await this.transporter.sendMail(mailOptions);
        } catch (error) {
            console.error('Email sending failed:', error);
            throw new Error('Failed to send email');
        }
    }

    // Send interview invitation
    async sendInterviewInvitation(candidate, interviewDetails) {
        const subject = 'Interview Invitation - TalentSync';
        const body = `Dear ${candidate.name},

You have been invited for an interview on ${interviewDetails.date} at ${interviewDetails.time}.

Interview Details:
- Type: ${interviewDetails.type}
- Duration: ${interviewDetails.duration}

Best regards,
TalentSync Team`;

        return this.sendEmail(candidate.email, subject, body);
    }

    // Send password reset email
    async sendPasswordResetEmail(user, resetToken) {
        const subject = 'Password Reset - TalentSync';
        const resetLink = `${config.frontendUrl}/reset-password?token=${resetToken}`;
        
        const body = `Dear ${user.firstName},

You have requested a password reset. Click the link below to reset your password:

${resetLink}

If you did not request this, please ignore this email.

Best regards,
TalentSync Team`;

        return this.sendEmail(user.email, subject, body);
    }
}

module.exports = new EmailService();