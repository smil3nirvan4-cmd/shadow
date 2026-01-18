/**
 * JARVIS ULTIMATE - Configuration System
 * 
 * Typed configuration management with Zod validation.
 * Merges YAML files with environment variables.
 */

import { z } from 'zod';
import { config as dotenv } from 'dotenv';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { ConfigurationError } from './errors.js';

// ============================================
// Configuration Schema
// ============================================

const AppConfigSchema = z.object({
    name: z.string().default('jarvis-ultimate'),
    env: z.enum(['development', 'production', 'test']).default('development'),
    port: z.number().min(1).max(65535).default(3000),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const PuppeteerConfigSchema = z.object({
    headless: z.boolean().default(true),
    args: z.array(z.string()).default(['--no-sandbox']),
    executablePath: z.string().optional(),
});

const WhatsAppConfigSchema = z.object({
    sessionPath: z.string().default('./.wwebjs_auth'),
    authorizedNumbers: z.array(z.string()).default([]),
    puppeteer: PuppeteerConfigSchema.default({}),
});

const AICacheConfigSchema = z.object({
    enabled: z.boolean().default(true),
    ttlSeconds: z.number().default(3600),
});

const AIConfigSchema = z.object({
    provider: z.enum(['gemini', 'openai', 'anthropic', 'ollama', 'grok']).default('gemini'),
    model: z.string().default('gemini-2.0-flash'),
    apiKey: z.string().min(1),
    maxTokens: z.number().default(8192),
    temperature: z.number().min(0).max(2).default(0.7),
    cache: AICacheConfigSchema.default({}),
    // OpenAI
    openaiApiKey: z.string().optional(),
    openaiModel: z.string().default('gpt-4-turbo-preview'),
    openaiBaseUrl: z.string().optional(),
    // Anthropic
    anthropicApiKey: z.string().optional(),
    anthropicModel: z.string().default('claude-3-sonnet-20240229'),
    // Ollama (Local)
    ollamaBaseUrl: z.string().default('http://localhost:11434'),
    ollamaModel: z.string().default('llama3'),
    // Grok (xAI)
    grokApiKey: z.string().optional(),
    grokModel: z.string().default('grok-4'),
    grokBaseUrl: z.string().default('https://api.x.ai/v1'),
});

const SQLiteConfigSchema = z.object({
    filename: z.string().default('brain.db'),
});

const StorageConfigSchema = z.object({
    type: z.enum(['sqlite', 'json']).default('sqlite'),
    path: z.string().default('./data'),
    sqlite: SQLiteConfigSchema.optional(),
});

const AnalyticsConfigSchema = z.object({
    retentionDays: z.number().default(30),
    maxLogsInMemory: z.number().default(1000),
    anomalyThreshold: z.number().min(0).max(1).default(0.8),
});

const ForensicsConfigSchema = z.object({
    enableCallInterception: z.boolean().default(true),
    enablePresenceTracking: z.boolean().default(true),
    enableAckTracking: z.boolean().default(true),
    enableDeviceFingerprinting: z.boolean().default(true),
});

const RateLimitConfigSchema = z.object({
    windowMs: z.number().default(60000),
    maxRequests: z.number().default(100),
});

const CorsConfigSchema = z.object({
    origins: z.array(z.string()).default(['http://localhost:3000']),
});

const SecurityConfigSchema = z.object({
    rateLimit: RateLimitConfigSchema.default({}),
    cors: CorsConfigSchema.default({}),
});

export const ConfigSchema = z.object({
    app: AppConfigSchema.default({}),
    whatsapp: WhatsAppConfigSchema.default({}),
    ai: AIConfigSchema,
    storage: StorageConfigSchema.default({}),
    analytics: AnalyticsConfigSchema.default({}),
    forensics: ForensicsConfigSchema.default({}),
    security: SecurityConfigSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;
export type AIConfig = z.infer<typeof AIConfigSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type AnalyticsConfig = z.infer<typeof AnalyticsConfigSchema>;
export type ForensicsConfig = z.infer<typeof ForensicsConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

// ============================================
// Configuration Manager
// ============================================

class ConfigManager {
    private config: Config | null = null;
    private configPath: string;

    constructor() {
        this.configPath = path.join(process.cwd(), 'config');
    }

    /**
     * Load and validate configuration
     * Merges: default.yaml < {env}.yaml < environment variables
     */
    load(): Config {
        if (this.config) {
            return this.config;
        }

        // Load .env file
        dotenv();

        const env = process.env.NODE_ENV || 'development';

        // Load YAML configs
        const defaultConfig = this.loadYaml('default.yaml');
        const envConfig = this.loadYaml(`${env}.yaml`);

        // Deep merge configs
        const merged = this.deepMerge(defaultConfig, envConfig);

        // Override with environment variables
        const withEnvVars = this.mergeWithEnvVars(merged);

        // Validate
        const result = ConfigSchema.safeParse(withEnvVars);

        if (!result.success) {
            const errors = result.error.format();
            throw new ConfigurationError(
                'Invalid configuration',
                { errors, env }
            );
        }

        this.config = result.data;
        return this.config;
    }

    /**
     * Get a specific configuration value by path
     */
    get<T>(path: string): T | undefined {
        if (!this.config) {
            this.load();
        }

        const parts = path.split('.');
        let current: unknown = this.config;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = (current as Record<string, unknown>)[part];
        }

        return current as T;
    }

    /**
     * Reload configuration (useful for hot-reload)
     */
    reload(): Config {
        this.config = null;
        return this.load();
    }

    /**
     * Check if running in production
     */
    isProduction(): boolean {
        return this.get<string>('app.env') === 'production';
    }

    /**
     * Check if running in development
     */
    isDevelopment(): boolean {
        return this.get<string>('app.env') === 'development';
    }

    private loadYaml(filename: string): Record<string, unknown> {
        const filePath = path.join(this.configPath, filename);

        if (!fs.existsSync(filePath)) {
            return {};
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return (yaml.load(content) as Record<string, unknown>) || {};
        } catch (error) {
            throw new ConfigurationError(
                `Failed to load config file: ${filename}`,
                { error: String(error) }
            );
        }
    }

    private mergeWithEnvVars(base: Record<string, unknown>): Record<string, unknown> {
        const env = process.env;

        return {
            ...base,
            app: {
                ...(base.app as object || {}),
                env: env.NODE_ENV || 'development',
                port: env.PORT ? parseInt(env.PORT, 10) : undefined,
                logLevel: env.LOG_LEVEL,
            },
            whatsapp: {
                ...(base.whatsapp as object || {}),
                sessionPath: env.WA_SESSION_PATH,
                authorizedNumbers: env.AUTHORIZED_NUMBERS
                    ? env.AUTHORIZED_NUMBERS.split(',').map(n => n.trim())
                    : undefined,
                puppeteer: {
                    ...((base.whatsapp as Record<string, unknown>)?.puppeteer as object || {}),
                    headless: env.PUPPETEER_HEADLESS === 'true',
                    executablePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
                },
            },
            ai: {
                ...(base.ai as object || {}),
                apiKey: env.GOOGLE_API_KEY || env.AI_API_KEY,
                model: env.AI_MODEL,
                temperature: env.AI_TEMPERATURE ? parseFloat(env.AI_TEMPERATURE) : undefined,
                maxTokens: env.AI_MAX_TOKENS ? parseInt(env.AI_MAX_TOKENS, 10) : undefined,
                // Grok (xAI)
                grokApiKey: env.GROK_API_KEY,
                grokModel: env.GROK_MODEL,
                grokBaseUrl: env.GROK_BASE_URL,
            },
            storage: {
                ...(base.storage as object || {}),
                type: env.STORAGE_TYPE,
                path: env.STORAGE_PATH,
                sqlite: {
                    ...((base.storage as Record<string, unknown>)?.sqlite as object || {}),
                    filename: env.SQLITE_FILENAME,
                },
            },
            analytics: {
                ...(base.analytics as object || {}),
                retentionDays: env.ANALYTICS_RETENTION_DAYS
                    ? parseInt(env.ANALYTICS_RETENTION_DAYS, 10)
                    : undefined,
                maxLogsInMemory: env.ANALYTICS_MAX_LOGS
                    ? parseInt(env.ANALYTICS_MAX_LOGS, 10)
                    : undefined,
                anomalyThreshold: env.ANOMALY_THRESHOLD
                    ? parseFloat(env.ANOMALY_THRESHOLD)
                    : undefined,
            },
            forensics: {
                ...(base.forensics as object || {}),
                enableCallInterception: env.ENABLE_CALL_INTERCEPTION === 'true',
                enablePresenceTracking: env.ENABLE_PRESENCE_TRACKING === 'true',
                enableAckTracking: env.ENABLE_ACK_TRACKING === 'true',
                enableDeviceFingerprinting: env.ENABLE_DEVICE_FINGERPRINTING === 'true',
            },
            security: {
                ...(base.security as object || {}),
                rateLimit: {
                    ...((base.security as Record<string, unknown>)?.rateLimit as object || {}),
                    windowMs: env.RATE_LIMIT_WINDOW_MS
                        ? parseInt(env.RATE_LIMIT_WINDOW_MS, 10)
                        : undefined,
                    maxRequests: env.RATE_LIMIT_MAX_REQUESTS
                        ? parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10)
                        : undefined,
                },
                cors: {
                    ...((base.security as Record<string, unknown>)?.cors as object || {}),
                    origins: env.CORS_ORIGINS
                        ? env.CORS_ORIGINS.split(',').map(o => o.trim())
                        : undefined,
                },
            },
        };
    }

    private deepMerge(
        target: Record<string, unknown>,
        source: Record<string, unknown>
    ): Record<string, unknown> {
        const result = { ...target };

        for (const key of Object.keys(source)) {
            const sourceValue = source[key];
            const targetValue = target[key];

            if (
                sourceValue !== null &&
                sourceValue !== undefined &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue) &&
                targetValue !== null &&
                targetValue !== undefined &&
                typeof targetValue === 'object' &&
                !Array.isArray(targetValue)
            ) {
                result[key] = this.deepMerge(
                    targetValue as Record<string, unknown>,
                    sourceValue as Record<string, unknown>
                );
            } else if (sourceValue !== undefined) {
                result[key] = sourceValue;
            }
        }

        return result;
    }
}

// Singleton instance
export const configManager = new ConfigManager();

// Helper function to get config
export function getConfig(): Config {
    return configManager.load();
}
