import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Business, BusinessDocument } from '../../database/schemas/business.schema';

@Injectable()
export class BusinessesService {
  constructor(@InjectModel(Business.name) private readonly businessModel: Model<BusinessDocument>) {}

  async findAll() {
    return this.businessModel.find().exec();
  }

  async findBySlug(slug: string) {
    const business = await this.businessModel.findOne({ slug }).exec();
    if (!business) {
      throw new NotFoundException('Negocio no encontrado');
    }
    return business;
  }

  async findById(id: string) {
    const business = await this.businessModel.findById(id).exec();
    if (!business) {
      throw new NotFoundException('Negocio no encontrado');
    }
    return business;
  }
}
