/**
 * JARVIS ULTIMATE - Event Bus
 * 
 * Centralized event emitter with strong typing for all domain events.
 * Provides decoupled communication between system components.
 */

import { EventEmitter } from 'events';
import { injectable, singleton } from 'tsyringe';
import type { Severity } from './errors.js';

// ============================================
// Domain Event Types
// ============================================

/**
 * ACK levels for message delivery status
 */
export enum AckLevel {
    ERROR = -1,
    PENDING = 0,
    SENT = 1,
    DELIVERED = 2,
    READ = 3,
    PLAYED = 4,
}

/**
 * Presence status types
 */
export enum PresenceStatus {
    ONLINE = 'online',
    OFFLINE = 'offline',
    TYPING = 'typing',
    RECORDING = 'recording',
    PAUSED = 'paused',
}

/**
 * Call types
 */
export enum CallType {
    VOICE = 'voice',
    VIDEO = 'video',
}

/**
 * Call status
 */
export enum CallStatus {
    RINGING = 'ringing',
    ANSWERED = 'answered',
    REJECTED = 'rejected',
    MISSED = 'missed',
    ENDED = 'ended',
}

// Placeholder interfaces (will be replaced with actual entities)
export interface Message {
    id: string;
    chatId: string;
    body: string;
    fromMe: boolean;
    timestamp: Date;
}

export interface Contact {
    id: string;
    name?: string;
    pushName?: string;
}

export interface Call {
    id: string;
    from: string;
    to: string;
    type: CallType;
    status: CallStatus;
}

export interface BehaviorPattern {
    type: string;
    confidence: number;
    details: Record<string, unknown>;
}

export interface ContactPrediction {
    nextContactTime: Date;
    confidence: number;
    basedOn: string[];
}

// ============================================
// Domain Events Interface
// ============================================

/**
 * All domain events with their payloads.
 * Provides type safety for event emission and handling.
 */
export interface DomainEvents {
    // Message Events
    'message:received': {
        message: Message;
        contact: Contact;
        timestamp: Date;
    };
    'message:sent': {
        messageId: string;
        chatId: string;
        latencyMs: number;
    };
    'message:ack': {
        messageId: string;
        ackLevel: AckLevel;
        readAt?: Date;
    };
    'message:revoked': {
        messageId: string;
        revokedBy: string;
        originalBody?: string;
    };

    // Presence Events
    'presence:online': {
        contactId: string;
        timestamp: Date;
    };
    'presence:offline': {
        contactId: string;
        lastSeen: Date;
    };
    'presence:typing': {
        contactId: string;
        chatId: string;
    };
    'presence:recording': {
        contactId: string;
        chatId: string;
    };

    // Call Events
    'call:incoming': {
        call: Call;
    };
    'call:answered': {
        callId: string;
        answeredAt: Date;
    };
    'call:rejected': {
        callId: string;
        reason?: string;
    };
    'call:ended': {
        callId: string;
        duration: number;
        endedBy: string;
    };
    'call:missed': {
        callId: string;
    };

    // Analytics Events
    'analytics:pattern-detected': {
        contactId: string;
        pattern: BehaviorPattern;
    };
    'analytics:anomaly': {
        type: string;
        severity: Severity;
        data: unknown;
    };
    'analytics:prediction': {
        contactId: string;
        prediction: ContactPrediction;
    };
    'analytics:anomaly_detected': {
        contactId: string;
        anomalies: unknown[];
    };
    'analytics:ghosting_alert': {
        contactId: string;
        score: number;
    };
    'analytics:predictions_generated': {
        predictions: unknown[];
    };

    // God Mode Events
    'godmode:ack': {
        log: unknown;
    };
    'godmode:call': {
        log: unknown;
    };
    'godmode:reaction': {
        log: unknown;
    };
    'godmode:message_deleted': {
        message: unknown;
    };
    'godmode:stalk_added': {
        contactId: string;
    };
    'godmode:stalk_removed': {
        contactId: string;
    };
    'godmode:presence_update': {
        log: unknown;
    };
    'godmode:viewonce_saved': {
        record: unknown;
    };
    'godmode:ghost_mode': {
        enabled: boolean;
    };

    // Forensics Events
    'forensics:device_change': {
        contactId: string;
        change: unknown;
    };
    'forensics:gps_detected': {
        contactId: string;
        gps: { lat: number; lon: number };
    };

    // System Events
    'system:ready': {
        timestamp: Date;
    };
    'system:error': {
        error: Error;
        context: Record<string, unknown>;
    };
    'system:shutdown': {
        reason: string;
    };

    // WhatsApp Events  
    'whatsapp:authenticated': {
        sessionId: string;
    };
    'whatsapp:disconnected': {
        reason: string;
    };
    'whatsapp:qr': {
        qr: string;
    };

    // Wildcard (for debugging)
    '*': {
        event: string;
        payload: unknown;
    };
}

// ============================================
// Event Bus Implementation
// ============================================

type EventHandler<T> = (payload: T) => void | Promise<void>;

@singleton()
@injectable()
export class EventBus {
    private emitter = new EventEmitter();
    private metrics = new Map<string, number>();
    private wildcardHandlers: EventHandler<DomainEvents['*']>[] = [];

    constructor() {
        // Increase max listeners for high-volume events
        this.emitter.setMaxListeners(100);
    }

    /**
     * Emit an event with type-safe payload
     */
    emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
        // Update metrics
        this.metrics.set(event, (this.metrics.get(event) || 0) + 1);

        // Emit to specific handlers
        this.emitter.emit(event, payload);

        // Emit to wildcard handlers
        if (event !== '*') {
            for (const handler of this.wildcardHandlers) {
                try {
                    handler({ event, payload });
                } catch (error) {
                    console.error(`Wildcard handler error for ${event}:`, error);
                }
            }
        }
    }

    /**
     * Subscribe to an event with type-safe handler
     */
    on<K extends keyof DomainEvents>(
        event: K,
        handler: EventHandler<DomainEvents[K]>
    ): void {
        if (event === '*') {
            this.wildcardHandlers.push(handler as EventHandler<DomainEvents['*']>);
            return;
        }

        this.emitter.on(event, async (payload: DomainEvents[K]) => {
            try {
                await handler(payload);
            } catch (error) {
                // Emit error but don't break other handlers
                this.emit('system:error', {
                    error: error as Error,
                    context: { event, payload },
                });
            }
        });
    }

    /**
     * Subscribe to an event once
     */
    once<K extends keyof DomainEvents>(
        event: K,
        handler: EventHandler<DomainEvents[K]>
    ): void {
        this.emitter.once(event, async (payload: DomainEvents[K]) => {
            try {
                await handler(payload);
            } catch (error) {
                this.emit('system:error', {
                    error: error as Error,
                    context: { event, payload },
                });
            }
        });
    }

    /**
     * Remove an event handler
     */
    off<K extends keyof DomainEvents>(
        event: K,
        handler: EventHandler<DomainEvents[K]>
    ): void {
        if (event === '*') {
            const index = this.wildcardHandlers.indexOf(
                handler as EventHandler<DomainEvents['*']>
            );
            if (index > -1) {
                this.wildcardHandlers.splice(index, 1);
            }
            return;
        }

        this.emitter.off(event, handler);
    }

    /**
     * Remove all handlers for an event
     */
    removeAllListeners<K extends keyof DomainEvents>(event?: K): void {
        if (event) {
            this.emitter.removeAllListeners(event);
        } else {
            this.emitter.removeAllListeners();
            this.wildcardHandlers = [];
        }
    }

    /**
     * Get event metrics
     */
    getMetrics(): Record<string, number> {
        return Object.fromEntries(this.metrics);
    }

    /**
     * Get count for a specific event
     */
    getEventCount<K extends keyof DomainEvents>(event: K): number {
        return this.metrics.get(event) || 0;
    }

    /**
     * Reset metrics
     */
    resetMetrics(): void {
        this.metrics.clear();
    }

    /**
     * Wait for an event with timeout
     */
    waitFor<K extends keyof DomainEvents>(
        event: K,
        timeoutMs = 30000
    ): Promise<DomainEvents[K]> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for event: ${event}`));
            }, timeoutMs);

            this.once(event, (payload) => {
                clearTimeout(timeout);
                resolve(payload);
            });
        });
    }
}

// ============================================
// Decorator for Event Handlers
// ============================================

/**
 * Decorator to mark a method as an event handler.
 * Usage: @OnEvent('message:received')
 */
export function OnEvent<K extends keyof DomainEvents>(event: K) {
    return function (
        target: object,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        // Store event metadata for later registration
        if (!Reflect.hasMetadata('events', target.constructor)) {
            Reflect.defineMetadata('events', [], target.constructor);
        }

        const events = Reflect.getMetadata('events', target.constructor) as Array<{
            event: K;
            method: string;
        }>;
        events.push({ event, method: propertyKey });
        Reflect.defineMetadata('events', events, target.constructor);

        return descriptor;
    };
}

/**
 * Register all event handlers from a class decorated with @OnEvent
 */
export function registerEventHandlers(
    eventBus: EventBus,
    instance: object
): void {
    const events = Reflect.getMetadata('events', instance.constructor) as Array<{
        event: keyof DomainEvents;
        method: string;
    }> | undefined;

    if (!events) return;

    for (const { event, method } of events) {
        const handler = (instance as Record<string, unknown>)[method];
        if (typeof handler === 'function') {
            eventBus.on(event, handler.bind(instance));
        }
    }
}
