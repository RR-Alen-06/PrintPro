import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET') || configService.get<string>('SUPABASE_JWT_SECRET');
    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET or SUPABASE_JWT_SECRET environment variable is not set. Please add it to your .env file.',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    // If it's a Supabase token, payload.sub is the Supabase UUID
    const supabaseId = payload.sub;
    const email = payload.email;

    // We can fallback to searching by email if supabaseId isn't linked yet,
    // though the /auth/sync endpoint should link it.
    let user = await this.userModel.findOne({ supabaseId }).exec();
    
    if (!user && email) {
       user = await this.userModel.findOne({ email }).exec();
    }

    if (!user) {
      // Allow fallback if they haven't synced yet? 
      // It's safer to just return the basic payload, and let /auth/sync create the user
      return {
        userId: payload.sub,
        email: payload.email,
        businessId: payload.app_metadata?.businessId || null,
        role: payload.app_metadata?.role || 'owner',
      };
    }

    return {
      userId: user._id.toString(), // or keep payload.sub
      supabaseId: user.supabaseId,
      email: user.email,
      businessId: user.businessId.toString(),
      role: user.role,
    };
  }
}
