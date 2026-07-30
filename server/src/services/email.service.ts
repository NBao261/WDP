import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(env.SMTP_PORT) || 587,
      secure: env.SMTP_SECURE === 'true', // true for 465, false for other ports
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
}

export const emailService = new EmailService();
