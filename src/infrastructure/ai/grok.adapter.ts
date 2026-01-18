/**
 * JARVIS ULTIMATE - Grok Adapter (xAI)
 * 
 * Implementation of AIProvider for xAI Grok models.
 * Uses OpenAI-compatible API at api.x.ai/v1
 * 
 * Supports: Grok 4, Grok 4.1 Fast (2M context)
 */

import {
    AIProvider,
    AIRequest,
    AIResponse,
} from '../../domain/ai/ai.types.js';
import { Config } from '../../core/config.js';
import { Result, ok, fail, AIProviderError } from '../../core/errors.js';

interface GrokMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface GrokChoice {
    index: number;
    message: {
        role: string;
        content: string;
    };
    finish_reason: string | null;
}

interface GrokUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

interface GrokResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: GrokChoice[];
    usage: GrokUsage;
}

interface GrokStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            role?: string;
            content?: string;
        };
        finish_reason: string | null;
    }>;
}

export class GrokAdapter implements AIProvider {
    readonly name = 'grok';
    private baseUrl: string;
    private modelName: string;
    private apiKey: string;

    constructor(config: Config) {
        this.baseUrl = config.ai.grokBaseUrl || 'https://api.x.ai/v1';
        this.modelName = config.ai.grokModel || 'grok-4';
        this.apiKey = config.ai.grokApiKey || '';
    }

    get model(): string {
        return this.modelName;
    }

    async generateContent(request: AIRequest): Promise<Result<AIResponse>> {
        const startTime = Date.now();

        try {
            const messages: GrokMessage[] = [];

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

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages,
                    temperature: request.temperature ?? 0.7,
                    max_tokens: request.maxTokens ?? 1000,
                    stream: false,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Grok API error ${response.status}: ${errorText}`);
            }

            const data = await response.json() as GrokResponse;
            const choice = data.choices[0];
            const content = choice?.message?.content || '';

            return ok({
                content,
                finishReason: this.mapFinishReason(choice?.finish_reason),
                usage: {
                    inputTokens: data.usage?.prompt_tokens || 0,
                    outputTokens: data.usage?.completion_tokens || 0,
                    totalTokens: data.usage?.total_tokens || 0,
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
        const messages: GrokMessage[] = [];

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
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages,
                    temperature: request.temperature ?? 0.7,
                    max_tokens: request.maxTokens ?? 1000,
                    stream: true,
                }),
            });

            if (!response.ok) {
                throw new Error(`Grok API error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {
                    const data = line.slice(6); // Remove 'data: ' prefix
                    if (data === '[DONE]') continue;

                    try {
                        const chunk: GrokStreamChunk = JSON.parse(data);
                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch {
                        // Skip invalid JSON lines
                    }
                }
            }
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async countTokens(text: string): Promise<number> {
        // Estimate: ~4 chars per token for English
        return Math.ceil(text.length / 4);
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey) return false;

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
            });
            return response.ok;
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
            return new AIProviderError('Grok rate limit exceeded', {
                provider: this.name,
                retryAfter: 60,
            });
        }

        if (message.includes('invalid_api_key') || message.includes('401')) {
            return new AIProviderError('Invalid Grok API key', {
                provider: this.name,
            });
        }

        if (message.includes('context_length') || message.includes('too long')) {
            return new AIProviderError('Context length exceeded', {
                provider: this.name,
                reason: 'context_length',
            });
        }

        return new AIProviderError(`Grok error: ${message}`, {
            provider: this.name,
            originalError: message,
        });
    }
}
