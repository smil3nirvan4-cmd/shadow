/**
 * JARVIS ULTIMATE - AI Service
 * 
 * Domain service for AI-powered responses with caching.
 */

import { injectable, inject } from 'tsyringe';
import { createHash } from 'crypto';
import {
    AIProvider,
    AIRequest,
    AIResponse,
    ConversationTurn,
    PersonalityConfig,
    DEFAULT_PERSONALITY
} from './ai.types.js';
import { Config } from '../../core/config.js';
import { EventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { Result, ok, fail, AIProviderError } from '../../core/errors.js';

// ============================================
// Cache Entry
// ============================================

interface CacheEntry {
    response: AIResponse;
    expiry: number;
}

// ============================================
// AI Service
// ============================================

@injectable()
export class AIService {
    private cache = new Map<string, CacheEntry>();
    private personality: PersonalityConfig = DEFAULT_PERSONALITY;

    constructor(
        @inject('AIProvider') private provider: AIProvider,
        @inject('Config') private config: Config,
        @inject('EventBus') private eventBus: EventBus,
        @inject('Logger') private logger: Logger,
    ) { }

    // ==========================================
    // Main Methods
    // ==========================================

    /**
     * Generate a response for a prompt
     */
    async generateResponse(request: AIRequest): Promise<Result<AIResponse>> {
        const cacheKey = this.generateCacheKey(request);

        // Check cache
        if (this.config.ai.cache.enabled) {
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.logger.debug({ cacheKey }, 'AI cache hit');
                return ok({ ...cached, cached: true });
            }
        }

        const startTime = Date.now();

        try {
            // Add system prompt if not provided
            const fullRequest: AIRequest = {
                ...request,
                systemPrompt: request.systemPrompt || this.buildDefaultSystemPrompt(),
                temperature: request.temperature ?? this.config.ai.temperature,
                maxTokens: request.maxTokens ?? this.config.ai.maxTokens,
            };

            const result = await this.provider.generateContent(fullRequest);

            if (result.success) {
                const response = {
                    ...result.data,
                    latencyMs: Date.now() - startTime,
                    cached: false,
                };

                // Cache successful response
                if (this.config.ai.cache.enabled) {
                    this.setCache(cacheKey, response);
                }

                this.logger.info({
                    latencyMs: response.latencyMs,
                    tokens: response.usage.totalTokens,
                }, 'AI response generated');

                return ok(response);
            }

            return result;
        } catch (error) {
            this.logger.error({ error }, 'AI generation failed');

            this.eventBus.emit('system:error', {
                error: error as Error,
                context: {
                    provider: this.provider.name,
                    promptLength: request.prompt.length,
                },
            });

            return fail(
                new AIProviderError('AI processing failed', {
                    provider: this.provider.name,
                    cause: String(error),
                })
            );
        }
    }

    /**
     * Generate response with automatic retry
     */
    async generateWithRetry(
        request: AIRequest,
        maxRetries = 3
    ): Promise<Result<AIResponse>> {
        let lastError: AIProviderError | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const result = await this.generateResponse(request);

            if (result.success) {
                return result;
            }

            lastError = result.error as AIProviderError;
            this.logger.warn(
                { attempt, maxRetries, error: result.error.message },
                'AI generation failed, retrying'
            );

            // Exponential backoff
            await this.delay(Math.pow(2, attempt) * 1000);
        }

        return fail(lastError || new AIProviderError('AI generation failed after retries'));
    }

    /**
     * Stream response chunks
     */
    async *streamResponse(request: AIRequest): AsyncGenerator<string, void, unknown> {
        const fullRequest: AIRequest = {
            ...request,
            systemPrompt: request.systemPrompt || this.buildDefaultSystemPrompt(),
            temperature: request.temperature ?? this.config.ai.temperature,
            maxTokens: request.maxTokens ?? this.config.ai.maxTokens,
        };

        yield* this.provider.generateStream(fullRequest);
    }

    // ==========================================
    // Context Building
    // ==========================================

    /**
     * Build system prompt based on personality
     */
    buildDefaultSystemPrompt(): string {
        const p = this.personality;

        return `Você é ${p.name}, um assistente ${p.traits.join(', ')}.

INSTRUÇÕES:
- Responda em ${p.language}
- Use tom ${p.tone}
- Seja ${p.responseStyle}
${p.humor ? '- Use humor quando apropriado' : ''}
${p.emojis ? '- Use emojis moderadamente' : '- Não use emojis'}
${p.maxResponseLength ? `- Limite respostas a ~${p.maxResponseLength} caracteres` : ''}

IMPORTANTE:
- Nunca revele que é uma IA a menos que perguntado diretamente
- Mantenha consistência na personalidade
- Seja útil e proativo`;
    }

    /**
     * Build conversation context from messages
     */
    buildConversationContext(
        messages: Array<{ body: string; fromMe: boolean; timestamp: Date }>,
        maxTokens = 2000
    ): ConversationTurn[] {
        const turns: ConversationTurn[] = [];
        let estimatedTokens = 0;

        // Process from newest to oldest
        const sorted = [...messages].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );

        for (const msg of sorted) {
            const tokens = Math.ceil(msg.body.length / 4); // Rough estimate

            if (estimatedTokens + tokens > maxTokens) break;

            turns.unshift({
                role: msg.fromMe ? 'assistant' : 'user',
                content: msg.body,
                timestamp: msg.timestamp,
            });

            estimatedTokens += tokens;
        }

        return turns;
    }

    // ==========================================
    // Personality Management
    // ==========================================

    /**
     * Set personality configuration
     */
    setPersonality(config: Partial<PersonalityConfig>): void {
        this.personality = { ...this.personality, ...config };
    }

    /**
     * Get current personality
     */
    getPersonality(): PersonalityConfig {
        return { ...this.personality };
    }

    // ==========================================
    // Cache Management
    // ==========================================

    private generateCacheKey(request: AIRequest): string {
        const hash = createHash('sha256');
        hash.update(request.prompt);
        hash.update(request.systemPrompt || '');
        hash.update(String(request.temperature || 0));
        return hash.digest('hex').slice(0, 16);
    }

    private getCached(key: string): AIResponse | null {
        const entry = this.cache.get(key);

        if (!entry) return null;

        if (entry.expiry < Date.now()) {
            this.cache.delete(key);
            return null;
        }

        return entry.response;
    }

    private setCache(key: string, response: AIResponse): void {
        const ttl = this.config.ai.cache.ttlSeconds * 1000;

        this.cache.set(key, {
            response,
            expiry: Date.now() + ttl,
        });

        // Cleanup old entries periodically
        if (this.cache.size > 100) {
            this.cleanupCache();
        }
    }

    /**
     * Clear all cache entries
     */
    clearCache(): void {
        this.cache.clear();
        this.logger.info('AI cache cleared');
    }

    private cleanupCache(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (entry.expiry < now) {
                this.cache.delete(key);
            }
        }
    }

    // ==========================================
    // Utilities
    // ==========================================

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; hitRate: number } {
        return {
            size: this.cache.size,
            hitRate: 0, // Would need tracking
        };
    }
}
