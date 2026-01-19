/**
 * JARVIS ULTIMATE - Gemini Adapter
 * 
 * Implementation of AIProvider for Google Gemini.
 */

import { injectable, inject } from 'tsyringe';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import {
    AIProvider,
    AIRequest,
    AIResponse,
    ConversationTurn
} from '../../domain/ai/ai.types.js';
import { Config } from '../../core/config.js';
import { Result, ok, fail, AIProviderError } from '../../core/errors.js';

@injectable()
export class GeminiAdapter implements AIProvider {
    readonly name = 'gemini';
    private client: GoogleGenerativeAI;
    private genModel: GenerativeModel;

    constructor(@inject('Config') private config: Config) {
        this.client = new GoogleGenerativeAI(config.ai.apiKey);
        this.genModel = this.client.getGenerativeModel({
            model: config.ai.model,
        });
    }

    get model(): string {
        return this.config.ai.model;
    }

    async generateContent(request: AIRequest): Promise<Result<AIResponse>> {
        const startTime = Date.now();

        try {
            // Build contents array
            const contents = this.buildContents(request);

            // Generate with timeout
            const generatePromise = this.genModel.generateContent({
                contents,
                generationConfig: {
                    temperature: request.temperature,
                    maxOutputTokens: request.maxTokens,
                    stopSequences: request.stopSequences,
                },
                systemInstruction: request.systemPrompt ? {
                    role: 'user',
                    parts: [{ text: request.systemPrompt }],
                } : undefined,
            });

            // Timeout promise (15 seconds)
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('GenerativeAI Timeout (15s)')), 15000);
            });

            const result = await Promise.race([generatePromise, timeoutPromise]);

            const response = result.response;
            const text = response.text();
            const usage = response.usageMetadata;

            return ok({
                content: text,
                finishReason: this.mapFinishReason(response.candidates?.[0]?.finishReason),
                usage: {
                    inputTokens: usage?.promptTokenCount || 0,
                    outputTokens: usage?.candidatesTokenCount || 0,
                    totalTokens: usage?.totalTokenCount || 0,
                },
                latencyMs: Date.now() - startTime,
                cached: false,
                model: this.config.ai.model,
            });

        } catch (error) {
            return fail(this.handleError(error));
        }
    }

    async *generateStream(request: AIRequest): AsyncGenerator<string, void, unknown> {
        const contents = this.buildContents(request);

        try {
            const result = await this.genModel.generateContentStream({
                contents,
                generationConfig: {
                    temperature: request.temperature,
                    maxOutputTokens: request.maxTokens,
                },
                systemInstruction: request.systemPrompt ? {
                    role: 'user',
                    parts: [{ text: request.systemPrompt }],
                } : undefined,
            });

            for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) {
                    yield text;
                }
            }
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async countTokens(text: string): Promise<number> {
        try {
            const result = await this.genModel.countTokens(text);
            return result.totalTokens;
        } catch {
            // Fallback: estimate ~4 chars per token
            return Math.ceil(text.length / 4);
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            await this.countTokens('test');
            return true;
        } catch {
            return false;
        }
    }

    // ==========================================
    // Private Methods
    // ==========================================

    private buildContents(request: AIRequest): Array<{
        role: 'user' | 'model';
        parts: Array<{ text: string }>;
    }> {
        const contents: Array<{
            role: 'user' | 'model';
            parts: Array<{ text: string }>;
        }> = [];

        // Add conversation history
        if (request.conversationHistory) {
            for (const turn of request.conversationHistory) {
                if (turn.role === 'system') continue; // Handled by systemInstruction

                contents.push({
                    role: turn.role === 'user' ? 'user' : 'model',
                    parts: [{ text: turn.content }],
                });
            }
        }

        // Add current prompt
        contents.push({
            role: 'user',
            parts: [{ text: request.prompt }],
        });

        return contents;
    }

    private mapFinishReason(
        reason?: string
    ): 'stop' | 'length' | 'tool_call' | 'error' | 'content_filter' {
        switch (reason) {
            case 'STOP':
                return 'stop';
            case 'MAX_TOKENS':
                return 'length';
            case 'SAFETY':
            case 'RECITATION':
                return 'content_filter';
            default:
                return 'stop';
        }
    }

    private handleError(error: unknown): AIProviderError {
        const message = error instanceof Error ? error.message : String(error);

        // Check for specific error types
        if (message.includes('RATE_LIMIT') || message.includes('429')) {
            return new AIProviderError('Gemini rate limit exceeded', {
                provider: this.name,
                retryAfter: 60,
            });
        }

        if (message.includes('API_KEY') || message.includes('401')) {
            return new AIProviderError('Invalid Gemini API key', {
                provider: this.name,
            });
        }

        if (message.includes('SAFETY')) {
            return new AIProviderError('Content blocked by safety filters', {
                provider: this.name,
                reason: 'safety',
            });
        }

        return new AIProviderError(`Gemini error: ${message}`, {
            provider: this.name,
            originalError: message,
        });
    }
}
