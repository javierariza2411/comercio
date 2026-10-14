import { Injectable } from '@nestjs/common';
import { PlanCode } from '@prisma/client';
import { parseConfig, PlanLimits, planLimitsSchema } from '../../config/tenant-config';
import { PrismaService } from '../../prisma/prisma.module';

@Injectable()
export class PlansService {
  private cache = new Map<PlanCode, { limits: PlanLimits; features: Record<string, boolean>; at: number }>();
  private readonly ttlMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async getLimits(code: PlanCode): Promise<PlanLimits> {
    return (await this.get(code)).limits;
  }

  async hasFeature(code: PlanCode, feature: string): Promise<boolean> {
    return Boolean((await this.get(code)).features[feature]);
  }

  private async get(code: PlanCode) {
    const cached = this.cache.get(code);
    if (cached && Date.now() - cached.at < this.ttlMs) return cached;
    const plan = await this.prisma.plan.findUnique({ where: { code } });
    const entry = {
      limits: parseConfig(planLimitsSchema, plan?.limits),
      features: (plan?.features as Record<string, boolean>) ?? {},
      at: Date.now(),
    };
    this.cache.set(code, entry);
    return entry;
  }
}
