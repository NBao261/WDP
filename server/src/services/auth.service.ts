import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser, UserRole, UserStatus } from '../models/user.model';
import { AppError } from '../middlewares/error.middleware';
import { env } from '../config/env';
import { setCache, getCache, delCache } from '../config/redis';
import { EmailService } from './email.service';

export class AuthService {
  static generateTokens(user: IUser) {
    const payload = { userId: user._id, role: user.role };
    
    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
    });
    
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as any,
    });

    return { accessToken, refreshToken };
  }

  static async register(data: Partial<IUser>): Promise<{ user: Partial<IUser>; tokens: { accessToken: string; refreshToken: string } }> {
    const existingUser = await User.findOne({ $or: [{ email: data.email?.toLowerCase() }, { phone: data.phone }] });
    if (existingUser) {
      throw new AppError('Email or phone already in use', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password as string, salt);

    const newUser = new User({
      ...data,
      role: UserRole.DRIVER,
      password: hashedPassword,
    });

    await newUser.save();

    const tokens = this.generateTokens(newUser);
    
    const { password, ...userWithoutPassword } = newUser.toObject();

    return { user: userWithoutPassword, tokens };
  }

  static async login(email: string, passwordInput: string): Promise<{ user: Partial<IUser>; tokens: { accessToken: string; refreshToken: string } }> {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    if (user.status === UserStatus.LOCKED) {
      throw new AppError('Account is locked', 403);
    }

    if (user.status === UserStatus.INACTIVE || user.isDeleted) {
      throw new AppError('Account is inactive or has been deleted', 403);
    }

    const isMatch = await bcrypt.compare(passwordInput, user.password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.status = UserStatus.LOCKED;
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();
      throw new AppError('Invalid credentials', 401);
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    await user.save();

    const tokens = this.generateTokens(user);

    const populatedUser = await User.findById(user._id)
      .select('-password')
      .populate('assignedFacilities', 'name address status openTime closeTime');

    return { user: populatedUser!.toObject(), tokens };
  }


  static async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string; role: string };
      const user = await User.findById(decoded.userId);
      
      if (!user || user.status !== UserStatus.ACTIVE || user.isDeleted) {
        throw new AppError('Invalid token or user inactive', 401);
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  static async logout(accessToken: string): Promise<void> {
    try {
      const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
      if (decoded && decoded.exp) {
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn > 0) {
          await setCache(`blacklist:${accessToken}`, 'revoked', expiresIn);
        }
      }
    } catch (error) {
    }
  }

  // ── Forgot Password: Gửi OTP qua email ──────────────────
  static async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new AppError('Email không tồn tại trong hệ thống', 404);
    }

    if (user.status === UserStatus.LOCKED) {
      throw new AppError('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.', 403);
    }

    // Rate limit: chỉ cho gửi OTP 1 lần mỗi 60 giây
    const rateLimitKey = `otp_rate:${email.toLowerCase()}`;
    const rateLimited = await getCache(rateLimitKey);
    if (rateLimited) {
      throw new AppError('Vui lòng đợi 60 giây trước khi gửi lại mã OTP', 429);
    }

    // Tạo OTP 6 số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu OTP vào Redis (TTL 5 phút)
    await setCache(`otp:${email.toLowerCase()}`, otp, 300);

    await setCache(rateLimitKey, '1', 60);

    await EmailService.sendOtpEmail(email, otp);
  }

  static async verifyOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const storedOtp = await getCache<string>(`otp:${email.toLowerCase()}`);

    if (!storedOtp) {
      throw new AppError('Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại.', 400);
    }

    if (storedOtp !== otp) {
      throw new AppError('Mã OTP không chính xác', 400);
    }

    await delCache(`otp:${email.toLowerCase()}`);

    const resetToken = crypto.randomBytes(32).toString('hex');
    await setCache(`reset_token:${email.toLowerCase()}`, resetToken, 600);

    return { resetToken };
  }

  static async resetPasswordWithToken(email: string, token: string, newPassword: string): Promise<void> {
    const storedToken = await getCache<string>(`reset_token:${email.toLowerCase()}`);

    if (!storedToken || storedToken !== token) {
      throw new AppError('Token không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại.', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      throw new AppError('Tài khoản không tồn tại', 404);
    }

    // Hash password mới
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Reset trạng thái lock nếu có
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    if (user.status === UserStatus.LOCKED) {
      user.status = UserStatus.ACTIVE;
    }

    await user.save();

    // Xóa reset token (chỉ dùng 1 lần)
    await delCache(`reset_token:${email.toLowerCase()}`);
  }

  // ── Change Password: Đổi mật khẩu khi đã đăng nhập ──────
  static async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new AppError('Tài khoản không tồn tại', 404);
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new AppError('Mật khẩu hiện tại không đúng', 400);
    }

    if (oldPassword === newPassword) {
      throw new AppError('Mật khẩu mới phải khác mật khẩu hiện tại', 400);
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.mustChangePassword = false;
    await user.save();
  }
}

