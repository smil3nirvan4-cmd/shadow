/**
 * JARVIS ULTIMATE - Ollama Adapter (Local LLM)
 * 
 * Implementation of AIProvider for local Ollama/LM Studio.
 */

import {
    AIProvider,
    AIRequest,
    AIResponse,
} from '../../domain/ai/ai.types.js';
import { Config } from '../../core/config.js';
import { Result, ok, fail, AIProviderError } from '../../core/errors.js';

interface OllamaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OllamaResponse {
    model: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
    total_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
}

interface OllamaStreamChunk {
    model: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
}

export class OllamaAdapter implements AIProvider {
    readonly name = 'ollama';
    private baseUrl: string;
    private modelName: string;

    constructor(private config: Config) {
        this.baseUrl = config.ai.ollamaBaseUrl || 'http://localhost:11434';
        this.modelName = config.ai.ollamaModel || 'llama3';
    }

    get model(): string {
        return this.modelName;
    }

    async generateContent(request: AIRequest): Promise<Result<AIResponse>> {
        const startTime = Date.now();

        try {
            const messages: OllamaMessage[] = [];

            // System prompt
            if (request.systemPrompt) {
                messages.push({ role: 'system', content: request.systemPrompt });
            }

            // Conversation history
            if (request.conversationHistory) {
                for (const turn of request.conversationHistory) {
                    messages.push({
                        role: turn.role === 'assistant' ? 'assistant' : turn.role === 'system' ? 'system' : 'user',
                        content: turn.content,
                    });
                }
            }

            // Current prompt
            messages.push({ role: 'user', content: request.prompt });

            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    messages,
                    stream: false,
                    options: {
                        temperature: request.temperature ?? 0.7,
                        num_predict: request.maxTokens ?? 1000,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json() as OllamaResponse;

            return ok({
                content: data.message.content,
                finishReason: 'stop',
                usage: {
                    inputTokens: data.prompt_eval_count || 0,
                    outputTokens: data.eval_count || 0,
                    totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
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
        const messages: OllamaMessage[] = [];

        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }

        if (request.conversationHistory) {
            for (const turn of request.conversationHistory) {
                messages.push({
                    role: turn.role === 'assistant' ? 'assistant' : turn.role === 'system' ? 'system' : 'user',
                    content: turn.content,
                });
            }
        }

        messages.push({ role: 'user', content: request.prompt });

        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.modelName,
                    messages,
                    stream: true,
                    options: {
                        temperature: request.temperature ?? 0.7,
                        num_predict: request.maxTokens ?? 1000,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const chunk: OllamaStreamChunk = JSON.parse(line);
                        if (chunk.message?.content) {
                            yield chunk.message.content;
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
        // Estimate based on words (Llama uses ~1.3 tokens per word)
        const words = text.split(/\s+/).length;
        return Math.ceil(words * 1.3);
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * List available models on the Ollama server
     */
    async listModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (!response.ok) return [];

            const data = await response.json() as { models?: Array<{ name: string }> };
            return data.models?.map((m) => m.name) || [];
        } catch {
            return [];
        }
    }

    /**
     * Pull a model from Ollama registry
     */
    async pullModel(modelName: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName, stream: false }),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    private handleError(error: unknown): AIProviderError {
        const message = error instanceof Error ? error.message : String(error);

        if (message.includes('ECONNREFUSED') || message.includes('fetch')) {
            return new AIProviderError('Ollama server not running', {
                provider: this.name,
                reason: 'connection_refused',
            });
        }

        if (message.includes('model not found')) {
            return new AIProviderError(`Model ${this.modelName} not found`, {
                provider: this.name,
                reason: 'model_not_found',
            });
        }

        return new AIProviderError(`Ollama error: ${message}`, {
            provider: this.name,
            originalError: message,
        });
    }
}
