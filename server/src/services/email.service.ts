import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export class EmailService {
  static async sendOtpEmail(toEmail: string, otp: string): Promise<void> {
    const mailOptions = {
      from: `"Smart Parking" <${env.SMTP_USER}>`,
      to: toEmail,
      subject: '🔑 Mã OTP đặt lại mật khẩu - Smart Parking',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #ffffff; border-radius: 12px; border: 1px solid #eceef0;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: #14161C; color: #A4FF07; padding: 8px 20px; border-radius: 8px; font-size: 18px; font-weight: 700;">
              🅿️ Smart Parking
            </div>
          </div>
          <h2 style="color: #14161C; text-align: center; margin-bottom: 8px; font-size: 20px;">Đặt lại mật khẩu</h2>
          <p style="color: #6B7260; text-align: center; margin-bottom: 24px; font-size: 14px;">
            Bạn đã yêu cầu đặt lại mật khẩu. Sử dụng mã OTP bên dưới để tiếp tục:
          </p>
          <div style="background: #14161C; color: #A4FF07; text-align: center; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #9AA0A6; text-align: center; font-size: 13px; margin-bottom: 4px;">
            ⏱ Mã OTP có hiệu lực trong <strong>5 phút</strong>.
          </p>
          <p style="color: #9AA0A6; text-align: center; font-size: 13px;">
            Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
          </p>
          <hr style="border: none; border-top: 1px solid #eceef0; margin: 24px 0;" />
          <p style="color: #9AA0A6; text-align: center; font-size: 11px;">
            © ${new Date().getFullYear()} Smart Parking System
          </p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      logger.info(`[Email] OTP sent to ${toEmail}`);
    } catch (error: any) {
      logger.error(`[Email] Failed to send OTP to ${toEmail}`, { error: error.message });
      throw new Error('Không thể gửi email. Vui lòng thử lại sau.');
    }
  }
}
