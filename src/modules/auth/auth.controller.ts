import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { asyncHandler, successResponse } from '@utils/response';
import { COOKIE_NAMES, cookieConfig } from '@config/cookies';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, userType, profileData } = req.body;
    
    const result = await this.authService.register({
      email,
      password,
      userType,
      profileData,
    });

    return successResponse(res, result, 201);
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await this.authService.login(email, password, { req });

    if (result.requiresMFA) {
      // Store MFA challenge in secure HTTP-only cookie
      res.cookie(COOKIE_NAMES.MFA_TOKEN, result.mfaChallenge, cookieConfig.mfa_token);
      
      return successResponse(res, {
        requiresMFA: true,
        mfaMethod: result.mfaMethod,
        userId: result.userId,
      });
    }

    // Set authentication cookies
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, result.accessToken, cookieConfig.access);
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.refreshToken, cookieConfig.refresh);
    res.cookie(COOKIE_NAMES.SESSION_ID, result.sessionId, cookieConfig.session);

    return successResponse(res, {
      user: result.user,
      message: 'Login successful',
    });
  });

  verifyMFA = asyncHandler(async (req: Request, res: Response) => {
    const { userId, token } = req.body;
    const sessionInfo = await import('@utils/device-detection').then(m => 
      m.DeviceDetectionService.extractSessionInfo(req)
    );

    const result = await this.authService.verifyMFA(userId, token, sessionInfo);

    // Clear MFA challenge cookie
    res.clearCookie(COOKIE_NAMES.MFA_TOKEN);

    // Set authentication cookies
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, result.accessToken, cookieConfig.access);
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, result.refreshToken, cookieConfig.refresh);
    res.cookie(COOKIE_NAMES.SESSION_ID, result.sessionId, cookieConfig.session);

    return successResponse(res, {
      user: result.user,
      message: 'MFA verification successful',
    });
  });

  enableMFA = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const result = await this.authService.enableMFA(userId);

    return successResponse(res, result);
  });

  confirmMFA = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { token } = req.body;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const result = await this.authService.confirmMFA(userId, token);

    return successResponse(res, result);
  });

  disableMFA = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { password } = req.body;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const result = await this.authService.disableMFA(userId, password);

    return successResponse(res, result);
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies[COOKIE_NAMES.REFRESH_TOKEN] || req.body.refreshToken;

    if (!refreshToken) {
      throw new Error('Refresh token not provided');
    }

    const result = await this.authService.refreshToken(refreshToken, req);

    // Update access token cookie
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, result.accessToken, cookieConfig.access);

    return successResponse(res, {
      message: 'Token refreshed successfully',
    });
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const sessionId = req.cookies[COOKIE_NAMES.SESSION_ID] || req.sessionId;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    await this.authService.logout(userId, sessionId);

    // Clear all authentication cookies
    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN);
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN);
    res.clearCookie(COOKIE_NAMES.SESSION_ID);

    return successResponse(res, {
      message: 'Logged out successfully',
    });
  });

  verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw new Error('Verification token not provided');
    }

    const result = await this.authService.verifyEmail(token);

    return successResponse(res, result);
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    await this.authService.forgotPassword(email);

    return successResponse(res, {
      message: 'If the email exists, a password reset link has been sent',
    });
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    const result = await this.authService.resetPassword(token, newPassword);

    return successResponse(res, result);
  });

  getSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const sessions = await this.authService.getUserSessions(userId);

    return successResponse(res, { sessions });
  });

  revokeSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { sessionId } = req.params;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const result = await this.authService.revokeSession(userId, sessionId);

    return successResponse(res, result);
  });

  getProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const user = await this.authService.getUserById(userId);

    return successResponse(res, { user });
  });
}
