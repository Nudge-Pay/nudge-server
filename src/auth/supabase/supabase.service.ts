import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export interface SupabaseJwtPayload {
  sub: string;
  aud: string;
  email?: string;
  email_verified?: boolean;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

@Injectable()
export class SupabaseService {
  private readonly jwtSecret: string;

  constructor(private configService: ConfigService) {
    const secret = this.configService.get<string>('supabase.jwtSecret');
    if (!secret) {
      throw new Error('SUPABASE_JWT_SECRET is not configured');
    }
    this.jwtSecret = secret;
  }

  verifyToken(token: string): SupabaseJwtPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        clockTolerance: 5 * 60,
      }) as SupabaseJwtPayload;
      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('JWT token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid JWT token');
      }
      throw error;
    }
  }
}
