import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        exclude: ['tests/e2e/**/*'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            exclude: [
                'node_modules',
                'tests',
                'dist',
                '**/*.d.ts',
                'src/main.ts',
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 70,
            },
        },
        setupFiles: ['./tests/setup.ts'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@core': path.resolve(__dirname, 'src/core'),
            '@domain': path.resolve(__dirname, 'src/domain'),
            '@application': path.resolve(__dirname, 'src/application'),
            '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
            '@presentation': path.resolve(__dirname, 'src/presentation'),
        },
    },
});
