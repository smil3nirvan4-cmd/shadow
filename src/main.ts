/**
 * JARVIS ULTIMATE - Main Entry Point
 * 
 * Application entry point that bootstraps the system.
 */

import { bootstrap, setupSignalHandlers } from './core/bootstrap.js';
import { createServer } from './infrastructure/http/server.js';

async function main(): Promise<void> {
    try {
        // Bootstrap the application
        const { config, logger, eventBus, shutdown } = await bootstrap();

        // Setup signal handlers for graceful shutdown
        setupSignalHandlers(shutdown);

        // Create HTTP server
        const app = createServer();

        // Start listening
        const port = config.app.port;
        app.listen(port, () => {
            logger.info({ port }, `HTTP server listening on port ${port}`);
            logger.info(`Dashboard available at http://localhost:${port}`);
        });

        // Log event bus metrics every minute in development
        if (config.app.env === 'development') {
            setInterval(() => {
                const metrics = eventBus.getMetrics();
                if (Object.keys(metrics).length > 0) {
                    logger.debug({ metrics }, 'Event bus metrics');
                }
            }, 60000);
        }

    } catch (error) {
        console.error('Failed to start JARVIS ULTIMATE:', error);
        process.exit(1);
    }
}

// Run
main();
