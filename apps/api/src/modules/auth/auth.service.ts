import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { Business, BusinessDocument } from '../../database/schemas/business.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async register(payload: { name: string; email: string; password: string; businessName: string }) {
    const existingUser = await this.userModel.findOne({ email: payload.email.toLowerCase() });
    if (existingUser) {
      throw new ConflictException('Usuario ya registrado');
    }

    const slug = this.slugify(payload.businessName);
    const business = await this.businessModel.create({
      name: payload.businessName,
      slug,
      businessType: 'PRODUCT',
      branding: {
        primaryColor: '#111827',
        secondaryColor: '#f59e0b',
      },
      settings: {
        currency: 'COP',
        locale: 'es-CO',
        timezone: 'America/Bogota',
      },
      chatSettings: {
        enabled: true,
        aiEnabled: false,
        whatsappThreshold: 30,
      },
    });

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await this.userModel.create({
      name: payload.name,
      email: payload.email.toLowerCase(),
      passwordHash,
      businessId: business._id.toString(),
      role: 'BUSINESS_ADMIN',
      status: 'ACTIVE',
    });

    const token = this.jwtService.sign({ sub: user._id, email: user.email, businessId: business._id.toString(), role: user.role });

    return {
      access_token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        businessId: business._id,
      },
      business,
    };
  }

  async login(payload: { email: string; password: string }) {
    const user = await this.userModel.findOne({ email: payload.email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const business = await this.businessModel.findById(user.businessId).exec();
    const token = this.jwtService.sign({ sub: user._id, email: user.email, businessId: user.businessId, role: user.role });

    return {
      access_token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        businessId: user.businessId,
      },
      business,
    };
  }

  async validateUser(userId: string) {
    return this.userModel.findById(userId).exec();
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'business';
  }
}
