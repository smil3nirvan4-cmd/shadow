/**
 * JARVIS ULTIMATE - Test Setup
 */

import { container } from 'tsyringe';
import { beforeEach, afterEach, vi } from 'vitest';
import 'reflect-metadata';

// Reset container between tests
beforeEach(() => {
    container.clearInstances();
});

afterEach(() => {
    vi.clearAllMocks();
});

// Mock implementations
export const mockEventBus = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    getMetrics: vi.fn(() => ({})),
    resetMetrics: vi.fn(),
    waitFor: vi.fn(),
};

export const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger),
};

export const mockConfig = {
    app: {
        name: 'jarvis-test',
        env: 'test' as const,
        port: 3000,
        logLevel: 'debug' as const,
    },
    whatsapp: {
        sessionPath: './.wwebjs_auth_test',
        authorizedNumbers: ['5511999999999@c.us'],
        puppeteer: {
            headless: true,
            args: ['--no-sandbox'],
        },
    },
    ai: {
        provider: 'gemini' as const,
        model: 'gemini-2.0-flash',
        apiKey: 'test-api-key',
        maxTokens: 8192,
        temperature: 0.7,
        cache: {
            enabled: false,
            ttlSeconds: 3600,
        },
    },
    storage: {
        type: 'sqlite' as const,
        path: './data/test',
        sqlite: {
            filename: 'test.db',
        },
    },
    analytics: {
        retentionDays: 30,
        maxLogsInMemory: 1000,
        anomalyThreshold: 0.8,
    },
    forensics: {
        enableCallInterception: true,
        enablePresenceTracking: true,
        enableAckTracking: true,
        enableDeviceFingerprinting: true,
    },
    security: {
        rateLimit: {
            windowMs: 60000,
            maxRequests: 1000,
        },
        cors: {
            origins: ['http://localhost:3000'],
        },
    },
};

// Register mocks in container
export function setupMocks(): void {
    container.register('EventBus', { useValue: mockEventBus });
    container.register('Logger', { useValue: mockLogger });
    container.register('Config', { useValue: mockConfig });
}
