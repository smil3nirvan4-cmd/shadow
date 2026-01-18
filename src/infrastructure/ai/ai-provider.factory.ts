/**
 * JARVIS ULTIMATE - AI Provider Factory
 * 
 * Dynamic provider selection and fallback management.
 */

import { injectable, inject, container } from 'tsyringe';
import { AIProvider } from '../../domain/ai/ai.types.js';
import { Config } from '../../core/config.js';
import { Logger } from '../../core/logger.js';
import { GeminiAdapter } from './gemini.adapter.js';

// ============================================
// Provider Registry
// ============================================

export type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'grok';

interface ProviderConfig {
    type: ProviderType;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}

// ============================================
// AI Provider Factory
// ============================================

@injectable()
export class AIProviderFactory {
    private providers: Map<ProviderType, AIProvider> = new Map();
    private currentProvider: ProviderType;

    constructor(
        @inject('Config') private config: Config,
        @inject('Logger') private logger: Logger,
    ) {
        this.currentProvider = this.config.ai.provider as ProviderType || 'gemini';
        this.initializeProviders();
    }

    // ==========================================
    // Provider Management
    // ==========================================

    private async initializeProviders(): Promise<void> {
        // Always register Gemini if API key exists
        if (this.config.ai.apiKey) {
            try {
                const gemini = container.resolve(GeminiAdapter);
                this.providers.set('gemini', gemini);
                this.logger.info('Gemini provider registered');
            } catch (error) {
                this.logger.warn({ error }, 'Failed to initialize Gemini provider');
            }
        }

        // Register OpenAI if configured
        if (this.config.ai.openaiApiKey) {
            try {
                const { OpenAIAdapter } = await import('./openai.adapter.js');
                const openai = new OpenAIAdapter(this.config);
                this.providers.set('openai', openai);
                this.logger.info('OpenAI provider registered');
            } catch (error) {
                this.logger.warn({ error }, 'Failed to initialize OpenAI provider');
            }
        }

        // Register Anthropic if configured
        if (this.config.ai.anthropicApiKey) {
            try {
                const { AnthropicAdapter } = await import('./anthropic.adapter.js');
                const anthropic = new AnthropicAdapter(this.config);
                this.providers.set('anthropic', anthropic);
                this.logger.info('Anthropic provider registered');
            } catch (error) {
                this.logger.warn({ error }, 'Failed to initialize Anthropic provider');
            }
        }

        // Register Ollama (local) if base URL is configured
        if (this.config.ai.ollamaBaseUrl) {
            try {
                const { OllamaAdapter } = await import('./ollama.adapter.js');
                const ollama = new OllamaAdapter(this.config);
                this.providers.set('ollama', ollama);
                this.logger.info('Ollama (local) provider registered');
            } catch (error) {
                this.logger.warn({ error }, 'Failed to initialize Ollama provider');
            }
        }

        // Register Grok (xAI) if API key is configured
        if (this.config.ai.grokApiKey) {
            try {
                const { GrokAdapter } = await import('./grok.adapter.js');
                const grok = new GrokAdapter(this.config);
                this.providers.set('grok', grok);
                this.logger.info('Grok (xAI) provider registered');
            } catch (error) {
                this.logger.warn({ error }, 'Failed to initialize Grok provider');
            }
        }
    }

    // ==========================================
    // Provider Selection
    // ==========================================

    /**
     * Get the current active provider
     */
    getProvider(): AIProvider {
        const provider = this.providers.get(this.currentProvider);

        if (!provider) {
            // Fallback to first available
            const [firstProvider] = this.providers.values();
            if (firstProvider) {
                return firstProvider;
            }
            throw new Error('No AI providers available');
        }

        return provider;
    }

    /**
     * Get a specific provider by type
     */
    getProviderByType(type: ProviderType): AIProvider | null {
        return this.providers.get(type) || null;
    }

    /**
     * Switch to a different provider
     */
    async switchProvider(type: ProviderType): Promise<boolean> {
        const provider = this.providers.get(type);

        if (!provider) {
            this.logger.warn({ type }, 'Provider not available');
            return false;
        }

        // Check if provider is working
        const isAvailable = await provider.isAvailable();

        if (!isAvailable) {
            this.logger.warn({ type }, 'Provider not responding');
            return false;
        }

        this.currentProvider = type;
        this.logger.info({ type }, 'Switched to provider');
        return true;
    }

    /**
     * Get list of available providers
     */
    getAvailableProviders(): ProviderType[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Get current provider type
     */
    getCurrentProviderType(): ProviderType {
        return this.currentProvider;
    }

    // ==========================================
    // Fallback Logic
    // ==========================================

    /**
     * Get provider with automatic fallback
     */
    async getProviderWithFallback(): Promise<AIProvider> {
        const primary = this.providers.get(this.currentProvider);

        if (primary && await primary.isAvailable()) {
            return primary;
        }

        // Try fallback providers in order
        const fallbackOrder: ProviderType[] = ['gemini', 'openai', 'anthropic', 'ollama'];

        for (const type of fallbackOrder) {
            if (type === this.currentProvider) continue;

            const provider = this.providers.get(type);
            if (provider && await provider.isAvailable()) {
                this.logger.info({ from: this.currentProvider, to: type }, 'Falling back to provider');
                return provider;
            }
        }

        throw new Error('All AI providers unavailable');
    }

    // ==========================================
    // Health Check
    // ==========================================

    /**
     * Check health of all providers
     */
    async checkAllProviders(): Promise<Record<ProviderType, boolean>> {
        const results: Record<string, boolean> = {};

        for (const [type, provider] of this.providers) {
            try {
                results[type] = await provider.isAvailable();
            } catch {
                results[type] = false;
            }
        }

        return results as Record<ProviderType, boolean>;
    }
}
