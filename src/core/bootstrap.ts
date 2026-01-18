/**
 * JARVIS ULTIMATE - Bootstrap
 * 
 * Application initialization and dependency injection setup.
 * Handles graceful startup and shutdown.
 */

import 'reflect-metadata';
import { container, DependencyContainer } from 'tsyringe';
import { configManager, Config, getConfig } from './config.js';
import { EventBus } from './event-bus.js';
import { createLogger, Logger } from './logger.js';

// ============================================
// Lifecycle Hooks
// ============================================

type LifecycleHook = () => void | Promise<void>;

interface LifecycleHooks {
    onBeforeStart: LifecycleHook[];
    onAfterStart: LifecycleHook[];
    onBeforeShutdown: LifecycleHook[];
    onAfterShutdown: LifecycleHook[];
}

const lifecycleHooks: LifecycleHooks = {
    onBeforeStart: [],
    onAfterStart: [],
    onBeforeShutdown: [],
    onAfterShutdown: [],
};

export function registerHook(
    phase: keyof LifecycleHooks,
    hook: LifecycleHook
): void {
    lifecycleHooks[phase].push(hook);
}

async function runHooks(phase: keyof LifecycleHooks): Promise<void> {
    for (const hook of lifecycleHooks[phase]) {
        await hook();
    }
}

// ============================================
// Bootstrap Result
// ============================================

export interface BootstrapResult {
    container: DependencyContainer;
    config: Config;
    logger: Logger;
    eventBus: EventBus;
    shutdown: () => Promise<void>;
}

// ============================================
// Bootstrap Function
// ============================================

let isBootstrapped = false;
let shutdownInProgress = false;

export async function bootstrap(
    env?: 'development' | 'production' | 'test'
): Promise<BootstrapResult> {
    if (isBootstrapped) {
        throw new Error('Application already bootstrapped');
    }

    // Set environment if provided
    if (env) {
        process.env.NODE_ENV = env;
    }

    // Load configuration
    const config = configManager.load();

    // Create logger
    const logger = createLogger();
    logger.info({ env: config.app.env }, 'Starting JARVIS ULTIMATE...');

    // Create event bus
    const eventBus = new EventBus();

    // Register core dependencies
    container.registerInstance('Config', config);
    container.registerInstance('Logger', logger);
    container.registerInstance('EventBus', eventBus);

    // Run before start hooks
    await runHooks('onBeforeStart');

    // Register storage infrastructure
    try {
        const { getDatabaseManager, SQLiteMessageRepository, SQLiteContactRepository } =
            await import('../infrastructure/storage/index.js');

        const dbManager = getDatabaseManager(config, logger);
        container.registerInstance('DatabaseManager', dbManager);
        container.register('MessageRepository', { useClass: SQLiteMessageRepository });
        container.register('ContactRepository', { useClass: SQLiteContactRepository });
        logger.info('SQLite repositories registered');
    } catch (error) {
        logger.warn({ error }, 'Failed to initialize storage, using in-memory fallback');
    }

    // Register domain services
    try {
        const { GodModeService } = await import('../domain/forensics/god-mode.service.js');
        const { BehavioralAnalyticsService } = await import('../domain/analytics/behavioral-analytics.service.js');

        // Create and register service instances
        const godModeService = new GodModeService(eventBus, logger);
        const analyticsService = new BehavioralAnalyticsService(eventBus, logger);

        container.registerInstance(GodModeService, godModeService);
        container.registerInstance(BehavioralAnalyticsService, analyticsService);
        container.registerInstance('GodModeService', godModeService);
        container.registerInstance('BehavioralAnalyticsService', analyticsService);

        logger.info('Domain services registered (GodMode, Analytics)');
    } catch (error) {
        logger.warn({ error }, 'Failed to initialize domain services');
    }

    // Mark as bootstrapped
    isBootstrapped = true;

    // Emit system ready event
    eventBus.emit('system:ready', { timestamp: new Date() });
    logger.info('JARVIS ULTIMATE is ready!');

    // Run after start hooks
    await runHooks('onAfterStart');

    // Return bootstrap result with shutdown function
    return {
        container,
        config,
        logger,
        eventBus,
        shutdown: createShutdown(logger, eventBus),
    };
}

// ============================================
// Shutdown Function
// ============================================

function createShutdown(
    logger: Logger,
    eventBus: EventBus
): () => Promise<void> {
    return async () => {
        if (shutdownInProgress) {
            logger.warn('Shutdown already in progress');
            return;
        }

        shutdownInProgress = true;
        logger.info('Shutting down JARVIS ULTIMATE...');

        // Run before shutdown hooks
        await runHooks('onBeforeShutdown');

        // Emit shutdown event
        eventBus.emit('system:shutdown', { reason: 'graceful' });

        // Close connections (will be implemented in later phases)
        // await closeWhatsAppConnection();
        // await closeDatabase();

        // Clear container
        container.clearInstances();

        // Run after shutdown hooks
        await runHooks('onAfterShutdown');

        isBootstrapped = false;
        shutdownInProgress = false;
        logger.info('JARVIS ULTIMATE shutdown complete');
    };
}

// ============================================
// Signal Handlers
// ============================================

let shutdownFn: (() => Promise<void>) | null = null;

export function setupSignalHandlers(shutdown: () => Promise<void>): void {
    shutdownFn = shutdown;

    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];

    for (const signal of signals) {
        process.on(signal, async () => {
            console.log(`\nReceived ${signal}, starting graceful shutdown...`);
            if (shutdownFn) {
                await shutdownFn();
            }
            process.exit(0);
        });
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
        if (shutdownFn) {
            await shutdownFn();
        }
        process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
        console.error('Unhandled Rejection:', reason);
        if (shutdownFn) {
            await shutdownFn();
        }
        process.exit(1);
    });
}

// ============================================
// Resolve Dependencies Helper
// ============================================

export function resolve<T>(token: string): T {
    return container.resolve<T>(token);
}

export function resolveOptional<T>(token: string): T | null {
    try {
        return container.resolve<T>(token);
    } catch {
        return null;
    }
}
