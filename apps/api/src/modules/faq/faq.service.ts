import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Faq, FaqDocument } from '../../database/schemas/faq.schema';

@Injectable()
export class FaqService {
  constructor(@InjectModel(Faq.name) private readonly faqModel: Model<FaqDocument>) {}

  async findByBusiness(businessId: string) {
    return this.faqModel.find({ businessId, active: true }).exec();
  }

  async queryByKeywords(businessId: string, query: string) {
    const normalized = query.toLowerCase();
    return this.faqModel.find({
      businessId,
      active: true,
      $or: [
        { question: { $regex: normalized, $options: 'i' } },
        { keywords: { $in: [normalized] } },
        { answer: { $regex: normalized, $options: 'i' } },
      ],
    }).exec();
  }
}
