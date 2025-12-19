import { Request } from 'express';
import UAParser from 'ua-parser-js';

export interface DeviceInfo {
  device: string;
  browser: string;
  os: string;
  userAgent: string;
}

export interface LocationInfo {
  country: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export class DeviceDetectionService {
  /**
   * Parse user agent to extract device information
   */
  static parseUserAgent(userAgent: string): DeviceInfo {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    return {
      device: this.getDeviceType(result),
      browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
      os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
      userAgent,
    };
  }

  /**
   * Get device type from parsed result
   */
  private static getDeviceType(result: UAParser.IResult): string {
    if (result.device.type === 'mobile') return 'Mobile';
    if (result.device.type === 'tablet') return 'Tablet';
    if (result.device.type === 'smarttv') return 'Smart TV';
    if (result.device.type === 'wearable') return 'Wearable';
    if (result.device.type === 'console') return 'Console';
    return 'Desktop';
  }

  /**
   * Get IP address from request
   */
  static getIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((req as any).socket?.remoteAddress as string) || ((req as any).ip as string) || 'unknown';
  }

  /**
   * Get location from IP address (simplified - você pode integrar com serviços como MaxMind)
   */
  static async getLocationFromIP(_ipAddress: string): Promise<LocationInfo> {
    // TODO: Integrar com serviço de geolocalização (MaxMind, IPStack, etc.)
    // Por agora, retorna dados vazios
    
    // Exemplo de integração:
    // const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`);
    // return {
    //   country: response.data.country_name,
    //   city: response.data.city,
    //   latitude: response.data.latitude,
    //   longitude: response.data.longitude,
    // };

    return {
      country: null,
      city: null,
      latitude: null,
      longitude: null,
    };
  }

  /**
   * Extract complete session information from request
   */
  static async extractSessionInfo(req: Request): Promise<{
    ipAddress: string;
    deviceInfo: DeviceInfo;
    location: LocationInfo;
  }> {
    const ipAddress = this.getIpAddress(req);
    const userAgent = (req.headers['user-agent'] as string) || 'Unknown';
    const deviceInfo = this.parseUserAgent(userAgent);
    const location = await this.getLocationFromIP(ipAddress);

    return {
      ipAddress,
      deviceInfo,
      location,
    };
  }

  /**
   * Check if login is from suspicious location/device
   */
  static isSuspiciousLogin(
    currentIp: string,
    previousIps: string[],
    currentDevice: string,
    previousDevices: string[]
  ): boolean {
    // Verifica se é um IP completamente novo
    const isNewIp = !previousIps.includes(currentIp);
    
    // Verifica se é um dispositivo completamente novo
    const isNewDevice = !previousDevices.includes(currentDevice);
    
    // Considera suspeito se ambos são novos
    return isNewIp && isNewDevice && previousIps.length > 0;
  }
}
