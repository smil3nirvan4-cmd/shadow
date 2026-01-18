/**
 * JARVIS ULTIMATE - Presence Event Entity
 * 
 * Domain model for WhatsApp presence/status updates.
 */

import { z } from 'zod';
import { ValidationError, Result, ok, fail } from '../../core/errors.js';

// ============================================
// Enums
// ============================================

export enum PresenceStatus {
    ONLINE = 'online',
    OFFLINE = 'offline',
    TYPING = 'typing',
    RECORDING = 'recording',
    PAUSED = 'paused',
    AVAILABLE = 'available',
    UNAVAILABLE = 'unavailable',
}

// ============================================
// Schema
// ============================================

const PresenceEventSchema = z.object({
    id: z.string().default(() => `presence_${Date.now()}`),
    contactId: z.string().min(1),
    chatId: z.string().optional(),
    status: z.nativeEnum(PresenceStatus),
    timestamp: z.date(),
    lastSeen: z.date().optional(),
    sessionDuration: z.number().optional(), // seconds online
    metadata: z.record(z.unknown()).default({}),
});

export type PresenceEventProps = z.infer<typeof PresenceEventSchema>;

// ============================================
// Entity
// ============================================

export class PresenceEvent {
    private constructor(private readonly props: PresenceEventProps) { }

    static create(props: unknown): Result<PresenceEvent> {
        const result = PresenceEventSchema.safeParse(props);

        if (!result.success) {
            return fail(
                new ValidationError('Invalid presence event data', {
                    errors: result.error.format(),
                })
            );
        }

        return ok(new PresenceEvent(result.data));
    }

    // Getters
    get id(): string { return this.props.id; }
    get contactId(): string { return this.props.contactId; }
    get chatId(): string | undefined { return this.props.chatId; }
    get status(): PresenceStatus { return this.props.status; }
    get timestamp(): Date { return this.props.timestamp; }
    get lastSeen(): Date | undefined { return this.props.lastSeen; }
    get sessionDuration(): number | undefined { return this.props.sessionDuration; }
    get metadata(): Record<string, unknown> { return { ...this.props.metadata }; }

    // Domain Logic
    isOnline(): boolean {
        return [PresenceStatus.ONLINE, PresenceStatus.AVAILABLE].includes(this.props.status);
    }

    isActive(): boolean {
        return [
            PresenceStatus.ONLINE,
            PresenceStatus.TYPING,
            PresenceStatus.RECORDING,
        ].includes(this.props.status);
    }

    isTyping(): boolean {
        return this.props.status === PresenceStatus.TYPING;
    }

    isRecording(): boolean {
        return this.props.status === PresenceStatus.RECORDING;
    }

    getAgeInSeconds(): number {
        return Math.floor((Date.now() - this.props.timestamp.getTime()) / 1000);
    }

    toJSON(): PresenceEventProps {
        return { ...this.props };
    }
}
