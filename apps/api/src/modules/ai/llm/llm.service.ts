import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiProvider } from './gemini.provider';
import { MockProvider } from './mock.provider';
import { LlmProvider } from './provider';

export type ModelTier = 'small' | 'large' | 'embedding';

/**
 * Resuelve proveedor y modelos desde variables de entorno (sin nombres de modelo en el código).
 * AI_PROVIDER=disabled usa el proveedor mock (desarrollo, CI y suite de evaluación sin costo).
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly providers = new Map<string, LlmProvider>();
  readonly defaultProviderName: string;

  constructor(private readonly config: ConfigService) {
    this.providers.set('mock', new MockProvider());
    const geminiKey = config.get<string>('GEMINI_API_KEY');
    if (geminiKey) this.providers.set('gemini', new GeminiProvider(geminiKey));

    const requested = config.get<string>('AI_PROVIDER', 'disabled');
    this.defaultProviderName = requested !== 'disabled' && this.providers.has(requested) ? requested : 'mock';
    if (requested !== 'disabled' && this.defaultProviderName === 'mock') {
      this.logger.warn(`AI_PROVIDER=${requested} sin clave o adaptador disponible; usando proveedor mock`);
    }
  }

  provider(name = this.defaultProviderName): LlmProvider {
    return this.providers.get(name) ?? this.providers.get('mock')!;
  }

  availableProviders() {
    return [...this.providers.keys()];
  }

  model(tier: ModelTier, providerName = this.defaultProviderName): string {
    if (providerName === 'mock') return 'mock';
    const prefix = providerName.toUpperCase();
    const key = tier === 'small' ? `${prefix}_MODEL_SMALL` : tier === 'large' ? `${prefix}_MODEL_LARGE` : `${prefix}_MODEL_EMBEDDING`;
    const value = this.config.get<string>(key);
    if (!value) throw new Error(`Falta la variable ${key} para el proveedor ${providerName}`);
    return value;
  }
}
