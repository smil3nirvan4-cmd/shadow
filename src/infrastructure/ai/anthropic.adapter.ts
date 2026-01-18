/**
 * JARVIS ULTIMATE - Anthropic Adapter
 * 
 * Implementation of AIProvider for Claude models.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
    AIProvider,
    AIRequest,
    AIResponse,
} from '../../domain/ai/ai.types.js';
import { Config } from '../../core/config.js';
import { Result, ok, fail, AIProviderError } from '../../core/errors.js';

export class AnthropicAdapter implements AIProvider {
    readonly name = 'anthropic';
    private client: Anthropic;
    private modelName: string;

    constructor(private config: Config) {
        this.client = new Anthropic({
            apiKey: config.ai.anthropicApiKey,
        });
        this.modelName = config.ai.anthropicModel || 'claude-3-sonnet-20240229';
    }

    get model(): string {
        return this.modelName;
    }

    async generateContent(request: AIRequest): Promise<Result<AIResponse>> {
        const startTime = Date.now();

        try {
            const messages: Anthropic.MessageParam[] = [];

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

            const response = await this.client.messages.create({
                model: this.modelName,
                max_tokens: request.maxTokens ?? 1024,
                system: request.systemPrompt,
                messages,
            });

            const content = response.content
                .filter((block): block is Anthropic.TextBlock => block.type === 'text')
                .map(block => block.text)
                .join('');

            return ok({
                content,
                finishReason: this.mapStopReason(response.stop_reason),
                usage: {
                    inputTokens: response.usage.input_tokens,
                    outputTokens: response.usage.output_tokens,
                    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
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
        const messages: Anthropic.MessageParam[] = [];

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
            const stream = await this.client.messages.stream({
                model: this.modelName,
                max_tokens: request.maxTokens ?? 1024,
                system: request.systemPrompt,
                messages,
            });

            for await (const event of stream) {
                if (event.type === 'content_block_delta' &&
                    event.delta.type === 'text_delta') {
                    yield event.delta.text;
                }
            }
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async countTokens(text: string): Promise<number> {
        // Anthropic has a tokenizer but we'll estimate
        // Claude uses ~3.5 chars per token on average
        return Math.ceil(text.length / 3.5);
    }

    async isAvailable(): Promise<boolean> {
        try {
            // Simple test generation
            await this.client.messages.create({
                model: this.modelName,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'test' }],
            });
            return true;
        } catch {
            return false;
        }
    }

    private mapStopReason(
        reason: string | null
    ): 'stop' | 'length' | 'tool_call' | 'error' | 'content_filter' {
        switch (reason) {
            case 'end_turn':
            case 'stop_sequence':
                return 'stop';
            case 'max_tokens':
                return 'length';
            case 'tool_use':
                return 'tool_call';
            default:
                return 'stop';
        }
    }

    private handleError(error: unknown): AIProviderError {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('rate_limit') || message.includes('429')) {
            return new AIProviderError('Anthropic rate limit exceeded', {
                provider: this.name,
                retryAfter: 60,
            });
        }

        if (message.includes('invalid_api_key') || message.includes('401')) {
            return new AIProviderError('Invalid Anthropic API key', {
                provider: this.name,
            });
        }

        if (message.includes('context_length') || message.includes('too long')) {
            return new AIProviderError('Context length exceeded', {
                provider: this.name,
                reason: 'context_length',
            });
        }

        return new AIProviderError(`Anthropic error: ${message}`, {
            provider: this.name,
            originalError: message,
        });
    }
}
