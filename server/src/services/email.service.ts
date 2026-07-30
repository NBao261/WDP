import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(env.SMTP_PORT) || 587,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  async sendAccountCreationEmail(to: string, name: string, pass: string, role: string) {
    if (!env.SMTP_USER || !env.SMTP_PASS) {
      logger.warn('SMTP credentials not configured, skipping account creation email.');
      return;
    }

    try {
      const html = `
        <h2>Xin chào ${name},</h2>
        <p>Tài khoản của bạn trên hệ thống Quản lý Bãi Đỗ Xe (WDP) đã được tạo thành công với vai trò: <b>${role}</b>.</p>
        <p>Thông tin đăng nhập của bạn:</p>
        <ul>
          <li><b>Email:</b> ${to}</li>
          <li><b>Mật khẩu:</b> ${pass}</li>
        </ul>
        <p>Vui lòng đăng nhập và đổi mật khẩu để bảo mật tài khoản.</p>
        <br/>
        <p>Trân trọng,</p>
        <p>Ban Quản Trị Hệ Thống WDP</p>
      `;

      await this.transporter.sendMail({
        from: `"WDP System" <${env.SMTP_USER}>`,
        to,
        subject: 'Thông tin tài khoản WDP',
        html,
      });

      logger.info(`Sent account creation email to ${to}`);
    } catch (error) {
      logger.error('Error sending account creation email:', error);
    }
  }

  async sendPasswordResetEmail(to: string, name: string, newPass: string) {
    if (!env.SMTP_USER || !env.SMTP_PASS) {
      logger.warn('SMTP credentials not configured, skipping password reset email.');
      return;
    }

    try {
      const html = `
        <h2>Xin chào ${name},</h2>
        <p>Mật khẩu tài khoản của bạn trên hệ thống Quản lý Bãi Đỗ Xe (WDP) đã được quản trị viên đặt lại.</p>
        <p>Thông tin đăng nhập mới của bạn:</p>
        <ul>
          <li><b>Email:</b> ${to}</li>
          <li><b>Mật khẩu mới:</b> ${newPass}</li>
        </ul>
        <p>Vui lòng đăng nhập và đổi mật khẩu mới trong lần đăng nhập tiếp theo.</p>
        <br/>
        <p>Trân trọng,</p>
        <p>Ban Quản Trị Hệ Thống WDP</p>
      `;

      await this.transporter.sendMail({
        from: `"WDP System" <${env.SMTP_USER}>`,
        to,
        subject: 'Mật khẩu tài khoản WDP đã được đặt lại',
        html,
      });

      logger.info(`Sent password reset email to ${to}`);
    } catch (error) {
      logger.error('Error sending password reset email:', error);
    }
  }

  async sendOtpEmail(toEmail: string, otp: string): Promise<void> {
    if (!env.SMTP_USER || !env.SMTP_PASS) {
      logger.warn('SMTP credentials not configured, skipping OTP email.');
      return;
    }

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
      await this.transporter.sendMail(mailOptions);
      logger.info(`[Email] OTP sent to ${toEmail}`);
    } catch (error: any) {
      logger.error(`[Email] Failed to send OTP to ${toEmail}`, { error: error.message });
      throw new Error('Không thể gửi email. Vui lòng thử lại sau.');
    }
  }
}

export const emailService = new EmailService();
