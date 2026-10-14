import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    FRONTEND_URL: z.string().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().default('smartcommerce'),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
    AI_PROVIDER: z.enum(['disabled', 'gemini', 'openai', 'anthropic']).default('disabled'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL_SMALL: z.string().default('gemini-2.5-flash'),
    GEMINI_MODEL_LARGE: z.string().default('gemini-2.5-pro'),
    GEMINI_MODEL_EMBEDDING: z.string().default('text-embedding-004'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().default(768),
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && /dev-only|change_me|change-me/i.test(env.JWT_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'JWT_SECRET de desarrollo no permitido en producción' });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${details}`);
  }
  return result.data;
}
