/**
 * JARVIS ULTIMATE - Call Entity
 * 
 * Domain model for WhatsApp calls with forensic metadata.
 */

import { z } from 'zod';
import { ValidationError, Result, ok, fail } from '../../core/errors.js';

// ============================================
// Enums
// ============================================

export enum CallStatus {
    RINGING = 'ringing',
    ANSWERED = 'answered',
    REJECTED = 'rejected',
    MISSED = 'missed',
    ENDED = 'ended',
}

export enum CallType {
    VOICE = 'voice',
    VIDEO = 'video',
}

// ============================================
// Schema
// ============================================

const CallSchema = z.object({
    id: z.string().min(1),
    chatId: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    type: z.nativeEnum(CallType),
    status: z.nativeEnum(CallStatus),
    isVideo: z.boolean().default(false),
    isGroup: z.boolean().default(false),
    participants: z.array(z.string()).default([]),
    startedAt: z.date(),
    answeredAt: z.date().optional(),
    endedAt: z.date().optional(),
    duration: z.number().optional(), // in seconds
    rejectionReason: z.string().optional(),
    metadata: z.record(z.unknown()).default({}),
});

export type CallProps = z.infer<typeof CallSchema>;

// ============================================
// Entity
// ============================================

export class Call {
    private constructor(private readonly props: CallProps) { }

    // ==========================================
    // Factory Method
    // ==========================================

    static create(props: unknown): Result<Call> {
        const result = CallSchema.safeParse(props);

        if (!result.success) {
            return fail(
                new ValidationError('Invalid call data', {
                    errors: result.error.format(),
                })
            );
        }

        return ok(new Call(result.data));
    }

    static fromRaw(rawCall: Record<string, unknown>): Result<Call> {
        const props = {
            id: rawCall.id || String(Date.now()),
            chatId: rawCall.from || rawCall.chatId,
            from: rawCall.from,
            to: rawCall.to || 'me',
            type: rawCall.isVideo ? CallType.VIDEO : CallType.VOICE,
            status: CallStatus.RINGING,
            isVideo: rawCall.isVideo ?? false,
            isGroup: rawCall.isGroup ?? false,
            participants: rawCall.participants || [],
            startedAt: new Date(),
            metadata: {},
        };

        return Call.create(props);
    }

    // ==========================================
    // Getters
    // ==========================================

    get id(): string { return this.props.id; }
    get chatId(): string { return this.props.chatId; }
    get from(): string { return this.props.from; }
    get to(): string { return this.props.to; }
    get type(): CallType { return this.props.type; }
    get status(): CallStatus { return this.props.status; }
    get isVideo(): boolean { return this.props.isVideo; }
    get isGroup(): boolean { return this.props.isGroup; }
    get participants(): string[] { return [...this.props.participants]; }
    get startedAt(): Date { return this.props.startedAt; }
    get answeredAt(): Date | undefined { return this.props.answeredAt; }
    get endedAt(): Date | undefined { return this.props.endedAt; }
    get rejectionReason(): string | undefined { return this.props.rejectionReason; }
    get metadata(): Record<string, unknown> { return { ...this.props.metadata }; }

    // ==========================================
    // Domain Logic
    // ==========================================

    /**
     * Get call duration in seconds
     */
    getDuration(): number {
        if (this.props.duration !== undefined) {
            return this.props.duration;
        }

        if (!this.props.answeredAt || !this.props.endedAt) {
            return 0;
        }

        return Math.floor(
            (this.props.endedAt.getTime() - this.props.answeredAt.getTime()) / 1000
        );
    }

    /**
     * Get formatted duration (HH:MM:SS or MM:SS)
     */
    getFormattedDuration(): string {
        const totalSeconds = this.getDuration();
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (n: number) => n.toString().padStart(2, '0');

        if (hours > 0) {
            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        }
        return `${pad(minutes)}:${pad(seconds)}`;
    }

    /**
     * Get ring duration (time before answer or end)
     */
    getRingDuration(): number {
        const endTime = this.props.answeredAt || this.props.endedAt || new Date();
        return Math.floor(
            (endTime.getTime() - this.props.startedAt.getTime()) / 1000
        );
    }

    /**
     * Check if call was answered
     */
    wasAnswered(): boolean {
        return this.props.status === CallStatus.ANSWERED ||
            this.props.status === CallStatus.ENDED && !!this.props.answeredAt;
    }

    /**
     * Check if call was missed
     */
    wasMissed(): boolean {
        return this.props.status === CallStatus.MISSED;
    }

    /**
     * Check if call was rejected
     */
    wasRejected(): boolean {
        return this.props.status === CallStatus.REJECTED;
    }

    /**
     * Check if call is still active
     */
    isActive(): boolean {
        return this.props.status === CallStatus.RINGING ||
            this.props.status === CallStatus.ANSWERED;
    }

    /**
     * Check if it's an incoming call
     */
    isIncoming(): boolean {
        return this.props.to === 'me' || !this.props.from.includes('@');
    }

    /**
     * Get other party's contact ID
     */
    getOtherParty(): string {
        return this.isIncoming() ? this.props.from : this.props.to;
    }

    // ==========================================
    // Immutable Updates
    // ==========================================

    answer(): Call {
        return new Call({
            ...this.props,
            status: CallStatus.ANSWERED,
            answeredAt: new Date(),
        });
    }

    reject(reason?: string): Call {
        return new Call({
            ...this.props,
            status: CallStatus.REJECTED,
            endedAt: new Date(),
            rejectionReason: reason,
        });
    }

    end(): Call {
        const now = new Date();
        const duration = this.props.answeredAt
            ? Math.floor((now.getTime() - this.props.answeredAt.getTime()) / 1000)
            : 0;

        return new Call({
            ...this.props,
            status: CallStatus.ENDED,
            endedAt: now,
            duration,
        });
    }

    miss(): Call {
        return new Call({
            ...this.props,
            status: CallStatus.MISSED,
            endedAt: new Date(),
        });
    }

    withMetadata(key: string, value: unknown): Call {
        return new Call({
            ...this.props,
            metadata: { ...this.props.metadata, [key]: value },
        });
    }

    // ==========================================
    // Serialization
    // ==========================================

    toJSON(): CallProps {
        return { ...this.props };
    }

    toString(): string {
        const type = this.props.isVideo ? '📹' : '📞';
        const status = this.props.status;
        return `Call[${type} ${this.getOtherParty()} - ${status}]`;
    }
}
