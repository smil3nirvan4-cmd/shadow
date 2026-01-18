/**
 * JARVIS ULTIMATE - AI Types and Interfaces
 * 
 * Abstractions for AI providers (Gemini, OpenAI, etc.)
 */

import { Result } from '../../core/errors.js';

// ============================================
// Request/Response Types
// ============================================

export interface ConversationTurn {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
}

export interface AIRequest {
    prompt: string;
    systemPrompt?: string;
    conversationHistory?: ConversationTurn[];
    temperature?: number;
    maxTokens?: number;
    stopSequences?: string[];
    tools?: AITool[];
}

export interface AIResponse {
    content: string;
    finishReason: 'stop' | 'length' | 'tool_call' | 'error' | 'content_filter';
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    latencyMs: number;
    cached: boolean;
    model: string;
    toolCalls?: AIToolCall[];
}

export interface AITool {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
}

export interface AIToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

// ============================================
// Provider Interface
// ============================================

export interface AIProvider {
    readonly name: string;
    readonly model: string;

    /**
     * Generate content from a prompt
     */
    generateContent(request: AIRequest): Promise<Result<AIResponse>>;

    /**
     * Generate content as a stream
     */
    generateStream(request: AIRequest): AsyncGenerator<string, void, unknown>;

    /**
     * Count tokens in a text
     */
    countTokens(text: string): Promise<number>;

    /**
     * Check if provider is available
     */
    isAvailable(): Promise<boolean>;
}

// ============================================
// Context Types
// ============================================

export interface ContactContext {
    name: string;
    relationship?: string;
    preferredLanguage?: string;
    communicationStyle?: string;
    interests?: string[];
    previousTopics?: string[];
}

export interface ConversationContext {
    recentMessages: ConversationTurn[];
    currentTopic?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    urgency?: 'low' | 'medium' | 'high';
}

// ============================================
// Personality Configuration
// ============================================

export interface PersonalityConfig {
    name: string;
    traits: string[];
    tone: 'formal' | 'casual' | 'friendly' | 'professional';
    language: string;
    responseStyle: 'concise' | 'detailed' | 'conversational';
    humor: boolean;
    emojis: boolean;
    maxResponseLength?: number;
}

export const DEFAULT_PERSONALITY: PersonalityConfig = {
    name: 'JARVIS',
    traits: ['helpful', 'intelligent', 'witty', 'efficient'],
    tone: 'friendly',
    language: 'pt-BR',
    responseStyle: 'conversational',
    humor: true,
    emojis: true,
    maxResponseLength: 500,
};
