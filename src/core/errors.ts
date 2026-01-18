/**
 * JARVIS ULTIMATE - Error Hierarchy
 * 
 * Base classes and specific error types for domain-driven error handling.
 * All errors extend DomainError and provide structured error responses.
 */

/**
 * Severity levels for errors and anomalies
 */
export enum Severity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

/**
 * Base class for all domain errors.
 * Provides structured error information for logging and API responses.
 */
export abstract class DomainError extends Error {
    abstract readonly code: string;
    abstract readonly httpStatus: number;
    readonly timestamp: Date;
    readonly context: Record<string, unknown>;
    readonly isOperational: boolean;

    constructor(
        message: string,
        context: Record<string, unknown> = {},
        isOperational = true
    ) {
        super(message);
        this.name = this.constructor.name;
        this.timestamp = new Date();
        this.context = context;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON(): ErrorResponse {
        return {
            code: this.code,
            message: this.message,
            timestamp: this.timestamp.toISOString(),
            context: this.context,
        };
    }

    toString(): string {
        return `[${this.code}] ${this.message}`;
    }
}

export interface ErrorResponse {
    code: string;
    message: string;
    timestamp: string;
    context: Record<string, unknown>;
}

// ============================================
// Specific Error Types
// ============================================

export class ConfigurationError extends DomainError {
    readonly code = 'CONFIG_ERROR';
    readonly httpStatus = 500;
}

export class ValidationError extends DomainError {
    readonly code = 'VALIDATION_ERROR';
    readonly httpStatus = 400;
}

export class AuthorizationError extends DomainError {
    readonly code = 'AUTHORIZATION_ERROR';
    readonly httpStatus = 403;
}

export class NotFoundError extends DomainError {
    readonly code = 'NOT_FOUND';
    readonly httpStatus = 404;
}

export class RateLimitError extends DomainError {
    readonly code = 'RATE_LIMIT';
    readonly httpStatus = 429;
}

export class WhatsAppConnectionError extends DomainError {
    readonly code = 'WA_CONNECTION_ERROR';
    readonly httpStatus = 503;
}

export class WhatsAppSessionError extends DomainError {
    readonly code = 'WA_SESSION_ERROR';
    readonly httpStatus = 401;
}

export class AIProviderError extends DomainError {
    readonly code = 'AI_PROVIDER_ERROR';
    readonly httpStatus = 502;
}

export class AIRateLimitError extends DomainError {
    readonly code = 'AI_RATE_LIMIT';
    readonly httpStatus = 429;
}

export class StorageError extends DomainError {
    readonly code = 'STORAGE_ERROR';
    readonly httpStatus = 500;
}

export class ForensicsError extends DomainError {
    readonly code = 'FORENSICS_ERROR';
    readonly httpStatus = 500;
}

export class CommandError extends DomainError {
    readonly code = 'COMMAND_ERROR';
    readonly httpStatus = 400;
}

// ============================================
// Result Type Pattern
// ============================================

/**
 * Result type for operations that can fail.
 * Provides a type-safe way to handle success and failure cases.
 */
export type Result<T, E extends DomainError = DomainError> =
    | { success: true; data: T }
    | { success: false; error: E };

/**
 * Create a successful result
 */
export function ok<T>(data: T): Result<T, never> {
    return { success: true, data };
}

/**
 * Create a failed result
 */
export function fail<E extends DomainError>(error: E): Result<never, E> {
    return { success: false, error };
}

/**
 * Type guard to check if result is successful
 */
export function isOk<T, E extends DomainError>(
    result: Result<T, E>
): result is { success: true; data: T } {
    return result.success === true;
}

/**
 * Type guard to check if result is failed
 */
export function isFail<T, E extends DomainError>(
    result: Result<T, E>
): result is { success: false; error: E } {
    return result.success === false;
}

/**
 * Unwrap a result, throwing the error if failed
 */
export function unwrap<T, E extends DomainError>(result: Result<T, E>): T {
    if (result.success) {
        return result.data;
    }
    throw result.error;
}

/**
 * Unwrap a result with a default value if failed
 */
export function unwrapOr<T, E extends DomainError>(
    result: Result<T, E>,
    defaultValue: T
): T {
    if (result.success) {
        return result.data;
    }
    return defaultValue;
}

/**
 * Map over a successful result
 */
export function mapResult<T, U, E extends DomainError>(
    result: Result<T, E>,
    fn: (data: T) => U
): Result<U, E> {
    if (result.success) {
        return ok(fn(result.data));
    }
    return result;
}

/**
 * Chain results (flatMap)
 */
export function flatMapResult<T, U, E extends DomainError>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>
): Result<U, E> {
    if (result.success) {
        return fn(result.data);
    }
    return result;
}

// ============================================
// Error Factory
// ============================================

export class ErrorFactory {
    static validation(message: string, context?: Record<string, unknown>): ValidationError {
        return new ValidationError(message, context);
    }

    static notFound(resource: string, id?: string): NotFoundError {
        return new NotFoundError(
            `${resource} not found${id ? `: ${id}` : ''}`,
            { resource, id }
        );
    }

    static unauthorized(message = 'Not authorized'): AuthorizationError {
        return new AuthorizationError(message);
    }

    static rateLimit(message = 'Rate limit exceeded'): RateLimitError {
        return new RateLimitError(message);
    }

    static whatsappConnection(message: string, context?: Record<string, unknown>): WhatsAppConnectionError {
        return new WhatsAppConnectionError(message, context);
    }

    static aiProvider(message: string, context?: Record<string, unknown>): AIProviderError {
        return new AIProviderError(message, context);
    }

    static storage(message: string, context?: Record<string, unknown>): StorageError {
        return new StorageError(message, context);
    }
}
