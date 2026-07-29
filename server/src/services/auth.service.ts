import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser, UserRole, UserStatus } from '../models/user.model';
import { AppError } from '../middlewares/error.middleware';
import { env } from '../config/env';
import { setCache } from '../config/redis';

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
    const existingUser = await User.findOne({ $or: [{ email: data.email }, { phone: data.phone }] });
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
    const user = await User.findOne({ email }).select('+password');
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
}
