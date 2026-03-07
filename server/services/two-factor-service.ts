import { generateSecret, generate, verify, generateURI } from 'otplib';
import QRCode from 'qrcode';

const APP_NAME = 'Gamefolio';

export class TwoFactorService {
  static generateSecretKey(): string {
    return generateSecret();
  }

  static generateKeyUri(email: string, secret: string): string {
    return generateURI({
      issuer: APP_NAME,
      label: email,
      secret
    });
  }

  static async generateQRCode(keyUri: string): Promise<string> {
    return QRCode.toDataURL(keyUri);
  }

  static async verifyToken(token: string, secret: string): Promise<boolean> {
    try {
      return await verify({ token, secret });
    } catch (error) {
      return false;
    }
  }

  static async setupTwoFactor(email: string): Promise<{ secret: string; qrCode: string; keyUri: string }> {
    const secret = this.generateSecretKey();
    const keyUri = this.generateKeyUri(email, secret);
    const qrCode = await this.generateQRCode(keyUri);
    
    return { secret, qrCode, keyUri };
  }
}
