import { Request, Response, NextFunction } from 'express';
import { CryptoService, JWTPayload } from '@utils/crypto';
import { UnauthorizedError } from '@utils/errors';
import prisma from '@config/database';
import { COOKIE_NAMES } from '@config/cookies';
import { UserType } from '@prisma/client';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & {
        id: string;
        userType: UserType;
        mfaVerified?: boolean;
      };
      sessionId?: string;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Try to get token from cookie first, then fallback to header
    let token = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Verify token
    const payload = CryptoService.verifyAccessToken(token);

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        userType: true,
        status: true,
        isEmailVerified: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    // Attach user to request
    req.user = {
      ...payload,
      id: user.id,
      userType: user.userType,
      mfaVerified: payload.mfaVerified || false,
    };

    // Get session ID from cookie
    req.sessionId = req.cookies?.[COOKIE_NAMES.SESSION_ID];

    // Update session activity if session exists
    if (req.sessionId) {
      await prisma.session.updateMany({
        where: {
          id: req.sessionId,
          userId: user.id,
          isActive: true,
        },
        data: {
          lastActivity: new Date(),
        },
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...userTypes: UserType[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!userTypes.includes(req.user.userType)) {
      return next(new UnauthorizedError('Insufficient permissions'));
    }

    next();
  };
};

export const requireEmailVerification = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isEmailVerified: true },
    });

    if (!user?.isEmailVerified) {
      return next(new UnauthorizedError('Email verification required'));
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireMFA = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!req.user.mfaVerified) {
    return next(new UnauthorizedError('MFA verification required'));
  }

  next();
};

export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    let token = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      try {
        const payload = CryptoService.verifyAccessToken(token);
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: {
            id: true,
            email: true,
            userType: true,
            status: true,
          },
        });

        if (user && user.status === 'ACTIVE') {
          req.user = {
            ...payload,
            id: user.id,
            userType: user.userType,
          };
        }
      } catch {
        // Ignore token errors for optional auth
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
