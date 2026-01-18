/**
 * JARVIS ULTIMATE - Logger
 * 
 * Structured logging with Pino.
 */

import pino from 'pino';
import { configManager } from './config.js';

let loggerInstance: pino.Logger | null = null;

export function createLogger(): pino.Logger {
    if (loggerInstance) {
        return loggerInstance;
    }

    const config = configManager.load();
    const isDev = config.app.env === 'development';

    loggerInstance = pino({
        level: config.app.logLevel,
        formatters: {
            level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
            service: config.app.name,
            env: config.app.env,
        },
        transport: isDev
            ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss',
                    ignore: 'pid,hostname,service,env',
                },
            }
            : undefined,
    });

    return loggerInstance;
}

export function getLogger(): pino.Logger {
    if (!loggerInstance) {
        return createLogger();
    }
    return loggerInstance;
}

export type Logger = pino.Logger;
