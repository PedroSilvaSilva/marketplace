import prisma from '@config/database';
import { CryptoService } from '@utils/crypto';
import { MFAService } from '@utils/mfa';
import { DeviceDetectionService } from '@utils/device-detection';
import { ConflictError, UnauthorizedError, NotFoundError } from '@utils/errors';
import emailService from '@utils/email';
import logger from '@config/logger';
import type { UserType, UserStatus, LoginResult, AuditAction, MFAMethod, OnlineStatus } from '@prisma/client';
import { Request } from 'express';

interface RegisterData {
  email: string;
  password: string;
  userType?: UserType;
  profileData?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    companyName?: string;
    companyVat?: string;
  };
}

interface LoginContext {
  req: Request;
}

interface SessionInfo {
  ipAddress: string;
  deviceInfo: {
    userAgent: string;
    device: string;
    browser: string;
    os: string;
  };
  location: {
    country: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

export class AuthService {
  async register(data: RegisterData) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const hashedPassword = await CryptoService.hashPassword(data.password);
    const emailVerificationToken = CryptoService.generateRandomToken(32);
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        userType: data.userType || 'USER',
        status: 'INACTIVE',
        emailVerificationToken,
        emailVerificationExpires,
        profile: {
          create: {
            firstName: data.profileData?.firstName,
            lastName: data.profileData?.lastName,
            phone: data.profileData?.phone,
            companyName: data.profileData?.companyName,
            companyVat: data.profileData?.companyVat,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    await emailService.sendVerificationEmail(user.email, emailVerificationToken);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        description: `User registered: ${user.email}`,
        metadata: { email: user.email, userType: user.userType },
      },
    });

    logger.info(`New user registered: ${user.email} (${user.userType})`);

    return {
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        status: user.status,
        profile: user.profile,
      },
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(email: string, password: string, context: LoginContext) {
    const sessionInfo = await DeviceDetectionService.extractSessionInfo(context.req);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });

    if (!user) {
      await this.logLoginAttempt(null, email, 'FAILED', sessionInfo, 'User not found');
      throw new UnauthorizedError('Invalid credentials');
    }

    const isPasswordValid = await CryptoService.comparePassword(password, user.password);

    if (!isPasswordValid) {
      await this.logLoginAttempt(user.id, email, 'FAILED', sessionInfo, 'Invalid password');
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.status === 'SUSPENDED') {
      await this.logLoginAttempt(user.id, email, 'BLOCKED', sessionInfo, 'Account suspended');
      throw new UnauthorizedError('Account is suspended');
    }

    if (user.mfaEnabled) {
      const mfaChallenge = MFAService.generateMFAChallenge();
      
      await this.logLoginAttempt(user.id, email, 'MFA_REQUIRED', sessionInfo, 'MFA required');

      return {
        requiresMFA: true,
        mfaMethod: user.mfaMethod,
        mfaChallenge,
        userId: user.id,
      };
    }

    const { accessToken, refreshToken, sessionId } = await this.createSession(
      user,
      sessionInfo,
      false
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.logLoginAttempt(user.id, email, 'SUCCESS', sessionInfo, null);

    logger.info(`User logged in: ${user.email} from ${sessionInfo.ipAddress}`);

    return {
      requiresMFA: false,
      accessToken,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        mfaEnabled: user.mfaEnabled,
        profile: user.profile,
      },
    };
  }

  private async createSession(
    user: { id: string; email: string; userType: UserType },
    sessionInfo: SessionInfo,
    mfaVerified: boolean
  ) {
    const accessToken = CryptoService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.userType,
      userType: user.userType,
      mfaVerified,
    });

    const refreshToken = CryptoService.generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.userType,
      userType: user.userType,
      mfaVerified,
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        ipAddress: sessionInfo.ipAddress,
        userAgent: sessionInfo.deviceInfo.userAgent,
        device: sessionInfo.deviceInfo.device,
        browser: sessionInfo.deviceInfo.browser,
        os: sessionInfo.deviceInfo.os,
        country: sessionInfo.location.country,
        city: sessionInfo.location.city,
        latitude: sessionInfo.location.latitude,
        longitude: sessionInfo.location.longitude,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
    };
  }

  private async logLoginAttempt(
    userId: string | null,
    email: string,
    result: LoginResult,
    sessionInfo: SessionInfo,
    reason: string | null
  ) {
    if (userId) {
      await prisma.loginHistory.create({
        data: {
          userId,
          result,
          reason,
          ipAddress: sessionInfo.ipAddress,
          userAgent: sessionInfo.deviceInfo.userAgent,
          device: sessionInfo.deviceInfo.device,
          browser: sessionInfo.deviceInfo.browser,
          os: sessionInfo.deviceInfo.os,
          country: sessionInfo.location.country,
          city: sessionInfo.location.city,
          latitude: sessionInfo.location.latitude,
          longitude: sessionInfo.location.longitude,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: result === 'SUCCESS' ? 'LOGIN' : 'LOGIN',
          entity: 'User',
          entityId: userId,
          description: `Login attempt: ${result}`,
          metadata: { email, result, reason },
          ipAddress: sessionInfo.ipAddress,
          userAgent: sessionInfo.deviceInfo.userAgent,
        },
      });
    }
  }

  async verifyMFA(userId: string, token: string, sessionInfo: SessionInfo) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.mfaEnabled) {
      throw new UnauthorizedError('Invalid MFA request');
    }

    let isValid = false;

    if (user.mfaMethod === 'TOTP' && user.mfaSecret) {
      isValid = MFAService.verifyTOTP(user.mfaSecret, token);
    } else if (user.mfaMethod === 'BACKUP_CODE' && user.backupCodes) {
      const updatedCodes = await MFAService.verifyBackupCode(token, user.backupCodes);
      if (updatedCodes) {
        isValid = true;
        await prisma.user.update({
          where: { id: userId },
          data: { backupCodes: { set: updatedCodes } },
        });
      }
    }

    if (!isValid) {
      await this.logLoginAttempt(userId, user.email, 'FAILED', sessionInfo, 'Invalid MFA token');
      throw new UnauthorizedError('Invalid MFA token');
    }

    const { accessToken, refreshToken, sessionId } = await this.createSession(
      user,
      sessionInfo,
      true
    );

    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    await this.logLoginAttempt(userId, user.email, 'SUCCESS', sessionInfo, 'MFA verified');

    logger.info(`User logged in with MFA: ${user.email}`);

    return {
      accessToken,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        mfaEnabled: user.mfaEnabled,
        profile: user.profile,
      },
    };
  }

  async enableMFA(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.mfaEnabled) {
      throw new ConflictError('MFA already enabled');
    }

    const { secret, qrCode, backupCodes } = await MFAService.generateTOTPSecret(user.email);
    const hashedBackupCodes = await MFAService.hashBackupCodes(backupCodes);

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret,
        backupCodes: hashedBackupCodes,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'MFA_ENABLE',
        entity: 'User',
        entityId: userId,
        description: 'MFA setup initiated',
      },
    });

    logger.info(`MFA setup initiated: ${user.email}`);

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  async confirmMFA(userId: string, token: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new NotFoundError('MFA setup not found');
    }

    const isValid = MFAService.verifyTOTP(user.mfaSecret, token);

    if (!isValid) {
      throw new UnauthorizedError('Invalid TOTP token');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaMethod: 'TOTP',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'MFA_ENABLE',
        entity: 'User',
        entityId: userId,
        description: 'MFA enabled successfully',
      },
    });

    logger.info(`MFA enabled: ${user.email}`);

    return { message: 'MFA enabled successfully' };
  }

  async disableMFA(userId: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isPasswordValid = await CryptoService.comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid password');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaMethod: null,
        mfaSecret: null,
        backupCodes: { set: [] },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'MFA_DISABLE',
        entity: 'User',
        entityId: userId,
        description: 'MFA disabled',
      },
    });

    logger.info(`MFA disabled: ${user.email}`);

    return { message: 'MFA disabled successfully' };
  }

  async refreshToken(refreshToken: string, req: Request) {
    let payload;
    try {
      payload = CryptoService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const session = await prisma.session.findFirst({
      where: {
        userId: payload.userId,
        refreshToken,
        isActive: true,
      },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const sessionInfo = await DeviceDetectionService.extractSessionInfo(req);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        lastActivity: new Date(),
        ipAddress: sessionInfo.ipAddress,
      },
    });

    const accessToken = CryptoService.generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      userType: payload.userType,
      mfaVerified: payload.mfaVerified,
    });

    return { accessToken };
  }

  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { isActive: false },
      });
    } else {
      await prisma.session.updateMany({
        where: { userId },
        data: { isActive: false },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        entity: 'User',
        entityId: userId,
        description: sessionId ? `Logged out session: ${sessionId}` : 'Logged out all sessions',
      },
    });

    logger.info(`User logged out: ${userId}`);
  }

  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new NotFoundError('Invalid or expired verification token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        status: 'ACTIVE',
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: user.id,
        description: 'Email verified',
      },
    });

    logger.info(`Email verified: ${user.email}`);

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return;
    }

    const resetToken = CryptoService.generateRandomToken(32);
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires,
      },
    });

    await emailService.sendPasswordResetEmail(user.email, resetToken);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_CHANGE',
        entity: 'User',
        entityId: user.id,
        description: 'Password reset requested',
      },
    });

    logger.info(`Password reset requested: ${user.email}`);
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new NotFoundError('Invalid or expired reset token');
    }

    const hashedPassword = await CryptoService.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_CHANGE',
        entity: 'User',
        entityId: user.id,
        description: 'Password reset completed',
      },
    });

    logger.info(`Password reset: ${user.email}`);

    return { message: 'Password reset successfully' };
  }

  async getUserSessions(userId: string) {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { lastActivity: 'desc' },
    });

    return sessions;
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundError('Session not found');
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        entity: 'Session',
        entityId: sessionId,
        description: 'Session revoked',
      },
    });

    logger.info(`Session revoked: ${sessionId} for user: ${userId}`);

    return { message: 'Session revoked successfully' };
  }

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }
}
