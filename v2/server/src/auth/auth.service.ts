import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../schemas/user.schema';
import { Business } from '../schemas/business.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Business.name) private readonly businessModel: Model<Business>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: {
    email: string;
    password?: string;
    shopName: string;
    ownerName: string;
  }) {
    const existing = await this.userModel
      .findOne({ email: registerDto.email })
      .exec();
    if (existing) {
      throw new BadRequestException('Email already registered.');
    }

    const business = new this.businessModel({
      shopName: registerDto.shopName,
      ownerName: registerDto.ownerName,
    });
    const savedBusiness = await business.save();

    const passwordHash = await bcrypt.hash(
      registerDto.password || 'password123',
      10,
    );
    const user = new this.userModel({
      email: registerDto.email,
      passwordHash,
      businessId: savedBusiness._id,
      role: 'owner',
    });
    await user.save();

    return this.loginUser(
      registerDto.email,
      registerDto.password || 'password123',
    );
  }

  async loginUser(email: string, password?: string) {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const match = await bcrypt.compare(
      password || 'password123',
      user.passwordHash,
    );
    if (!match) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const business = await this.businessModel.findById(user.businessId).exec();

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      businessId: user.businessId.toString(),
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        businessId: user.businessId.toString(),
      },
      business: business
        ? {
            id: business._id.toString(),
            shopName: business.shopName,
            ownerName: business.ownerName,
          }
        : null,
    };
  async syncUser(payload: any, shopName?: string, ownerName?: string) {
    const supabaseId = payload.userId; // We mapped this in JwtStrategy or from req.user
    const email = payload.email;

    if (!supabaseId || !email) {
      throw new UnauthorizedException('Invalid token payload missing email or sub');
    }

    let user = await this.userModel.findOne({ supabaseId }).exec();

    if (!user) {
      // Maybe user exists by email from V1?
      user = await this.userModel.findOne({ email }).exec();
      if (user) {
        user.supabaseId = supabaseId;
        await user.save();
      }
    }

    // If still no user, this is a brand new signup from Supabase
    if (!user) {
      const business = new this.businessModel({
        shopName: shopName || 'My Print Shop',
        ownerName: ownerName || email.split('@')[0],
      });
      const savedBusiness = await business.save();

      user = new this.userModel({
        email,
        supabaseId,
        passwordHash: 'supabase', // dummy
        businessId: savedBusiness._id,
        role: 'owner',
      });
      await user.save();
    }

    const business = await this.businessModel.findById(user.businessId).exec();

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        businessId: user.businessId.toString(),
      },
      business: business
        ? {
            id: business._id.toString(),
            shopName: business.shopName,
            ownerName: business.ownerName,
          }
        : null,
    };
  }
}
