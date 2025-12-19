import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

export class MFAService {
  /**
   * Generate TOTP secret and QR code for authenticator apps
   */
  static async generateTOTPSecret(email: string): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  }> {
    const secret = speakeasy.generateSecret({
      name: `CSW Markets (${email})`,
      issuer: 'CSW Markets',
      length: 32,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url as string);
    const backupCodes = this.generateBackupCodes();

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  }

  /**
   * Verify TOTP token
   */
  static verifyTOTP(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after
    });
  }

  /**
   * Generate backup codes for MFA
   */
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  /**
   * Hash backup codes for storage
   */
  static async hashBackupCodes(codes: string[]): Promise<string[]> {
    const { CryptoService } = await import('./crypto');
    return Promise.all(codes.map((code) => CryptoService.hashPassword(code)));
  }

  /**
   * Verify backup code
   */
  static async verifyBackupCode(
    code: string,
    hashedCodes: string[]
  ): Promise<string[] | null> {
    const { CryptoService } = await import('./crypto');

    for (let i = 0; i < hashedCodes.length; i++) {
      const hashedCode = hashedCodes[i];
      if (!hashedCode) continue;
      
      const isValid = await CryptoService.comparePassword(code, hashedCode);
      if (isValid) {
        // Remove used code and return remaining codes
        return hashedCodes.filter((_, index) => index !== i);
      }
    }

    return null; // Code not found
  }

  /**
   * Generate temporary MFA token for email/SMS
   */
  static generateMFAToken(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Generate MFA challenge token (stored in cookie)
   */
  static generateMFAChallenge(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
