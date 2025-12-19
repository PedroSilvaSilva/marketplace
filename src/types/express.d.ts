declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        email: string;
        role: string;
        userType: string;
        mfaVerified?: boolean;
      };
      sessionId?: string;
    }
  }
}

export {};
