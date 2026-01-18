/**
 * JARVIS ULTIMATE - OpenAI Adapter
 * 
 * Implementation of AIProvider for OpenAI GPT models.
 */

import OpenAI from 'openai';
import {
    AIProvider,
    AIRequest,
    AIResponse,
} from '../../domain/ai/ai.types.js';
import { Config } from '../../core/config.js';
import { Result, ok, fail, AIProviderError } from '../../core/errors.js';

export class OpenAIAdapter implements AIProvider {
    readonly name = 'openai';
    private client: OpenAI;
    private modelName: string;

    constructor(private config: Config) {
        this.client = new OpenAI({
            apiKey: config.ai.openaiApiKey,
            baseURL: config.ai.openaiBaseUrl, // Optional custom endpoint
        });
        this.modelName = config.ai.openaiModel || 'gpt-4-turbo-preview';
    }

    get model(): string {
        return this.modelName;
    }

    async generateContent(request: AIRequest): Promise<Result<AIResponse>> {
        const startTime = Date.now();

        try {
            const messages: OpenAI.ChatCompletionMessageParam[] = [];

            // System prompt
            if (request.systemPrompt) {
                messages.push({ role: 'system', content: request.systemPrompt });
            }

            // Conversation history
            if (request.conversationHistory) {
                for (const turn of request.conversationHistory) {
                    if (turn.role === 'system') continue;
                    messages.push({
                        role: turn.role === 'user' ? 'user' : 'assistant',
                        content: turn.content,
                    });
                }
            }

            // Current prompt
            messages.push({ role: 'user', content: request.prompt });

            const completion = await this.client.chat.completions.create({
                model: this.modelName,
                messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 1000,
                stop: request.stopSequences,
            });

            const choice = completion.choices[0];
            const content = choice?.message?.content || '';

            return ok({
                content,
                finishReason: this.mapFinishReason(choice?.finish_reason),
                usage: {
                    inputTokens: completion.usage?.prompt_tokens || 0,
                    outputTokens: completion.usage?.completion_tokens || 0,
                    totalTokens: completion.usage?.total_tokens || 0,
                },
                latencyMs: Date.now() - startTime,
                cached: false,
                model: this.modelName,
            });

        } catch (error) {
            return fail(this.handleError(error));
        }
    }

    async *generateStream(request: AIRequest): AsyncGenerator<string, void, unknown> {
        const messages: OpenAI.ChatCompletionMessageParam[] = [];

        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }

        if (request.conversationHistory) {
            for (const turn of request.conversationHistory) {
                if (turn.role === 'system') continue;
                messages.push({
                    role: turn.role === 'user' ? 'user' : 'assistant',
                    content: turn.content,
                });
            }
        }

        messages.push({ role: 'user', content: request.prompt });

        try {
            const stream = await this.client.chat.completions.create({
                model: this.modelName,
                messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 1000,
                stream: true,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    yield content;
                }
            }
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async countTokens(text: string): Promise<number> {
        // OpenAI doesn't have a direct token counting API
        // Estimate: ~4 chars per token for English
        return Math.ceil(text.length / 4);
    }

    async isAvailable(): Promise<boolean> {
        try {
            await this.client.models.retrieve(this.modelName);
            return true;
        } catch {
            return false;
        }
    }

    private mapFinishReason(
        reason?: string | null
    ): 'stop' | 'length' | 'tool_call' | 'error' | 'content_filter' {
        switch (reason) {
            case 'stop':
                return 'stop';
            case 'length':
                return 'length';
            case 'tool_calls':
            case 'function_call':
                return 'tool_call';
            case 'content_filter':
                return 'content_filter';
            default:
                return 'stop';
        }
    }

    private handleError(error: unknown): AIProviderError {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('rate_limit') || message.includes('429')) {
            return new AIProviderError('OpenAI rate limit exceeded', {
                provider: this.name,
                retryAfter: 60,
            });
        }

        if (message.includes('invalid_api_key') || message.includes('401')) {
            return new AIProviderError('Invalid OpenAI API key', {
                provider: this.name,
            });
        }

        if (message.includes('context_length')) {
            return new AIProviderError('Context length exceeded', {
                provider: this.name,
                reason: 'context_length',
            });
        }

        return new AIProviderError(`OpenAI error: ${message}`, {
            provider: this.name,
            originalError: message,
        });
    }
}
