/**
 * JARVIS ULTIMATE - Message Entity
 * 
 * Rich domain model for WhatsApp messages with validation and behavior.
 */

import { z } from 'zod';
import { ValidationError, Result, ok, fail } from '../../core/errors.js';

// ============================================
// Enums
// ============================================

export enum AckLevel {
    ERROR = -1,
    PENDING = 0,
    SENT = 1,
    DELIVERED = 2,
    READ = 3,
    PLAYED = 4,
}

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    VIDEO = 'video',
    AUDIO = 'audio',
    DOCUMENT = 'document',
    STICKER = 'sticker',
    LOCATION = 'location',
    CONTACT = 'contact',
    REVOKED = 'revoked',
    POLL = 'poll',
    REACTION = 'reaction',
}

// ============================================
// Schema
// ============================================

const MessageSchema = z.object({
    id: z.string().min(1),
    chatId: z.string().min(1),
    fromMe: z.boolean(),
    sender: z.string().min(1),
    body: z.string(),
    type: z.nativeEnum(MessageType),
    timestamp: z.date(),
    ack: z.nativeEnum(AckLevel),
    quotedMessageId: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    mimetype: z.string().optional(),
    filename: z.string().optional(),
    caption: z.string().optional(),
    isForwarded: z.boolean().default(false),
    forwardingScore: z.number().default(0),
    metadata: z.record(z.unknown()).default({}),
});

export type MessageProps = z.infer<typeof MessageSchema>;

// ============================================
// Entity
// ============================================

export class Message {
    private constructor(private readonly props: MessageProps) { }

    // ==========================================
    // Factory Method
    // ==========================================

    static create(props: unknown): Result<Message> {
        const result = MessageSchema.safeParse(props);

        if (!result.success) {
            return fail(
                new ValidationError('Invalid message data', {
                    errors: result.error.format(),
                })
            );
        }

        return ok(new Message(result.data));
    }

    static fromRaw(rawMessage: Record<string, unknown>): Result<Message> {
        // Transform raw WhatsApp message to our format
        const props = {
            id: (rawMessage.id as Record<string, unknown>)?.['_serialized'] as string || rawMessage.id as string,
            chatId: rawMessage.from || rawMessage.chatId,
            fromMe: rawMessage.fromMe ?? false,
            sender: rawMessage.author || rawMessage.from,
            body: rawMessage.body || '',
            type: Message.determineType(rawMessage),
            timestamp: rawMessage.timestamp
                ? new Date((rawMessage.timestamp as number) * 1000)
                : new Date(),
            ack: rawMessage.ack || AckLevel.PENDING,
            quotedMessageId: ((rawMessage.quotedMsg as Record<string, unknown>)?.id as Record<string, unknown>)?.['_serialized'] as string | undefined,
            mediaUrl: rawMessage.mediaUrl as string | undefined,
            mimetype: rawMessage.mimetype as string | undefined,
            filename: rawMessage.filename as string | undefined,
            caption: rawMessage.caption as string | undefined,
            isForwarded: rawMessage.isForwarded ?? false,
            forwardingScore: rawMessage.forwardingScore ?? 0,
            metadata: {},
        };

        return Message.create(props);
    }

    private static determineType(raw: Record<string, unknown>): MessageType {
        if (raw.type === 'image' || raw.hasMedia && raw.mimetype?.toString().startsWith('image/')) {
            return MessageType.IMAGE;
        }
        if (raw.type === 'video' || raw.mimetype?.toString().startsWith('video/')) {
            return MessageType.VIDEO;
        }
        if (raw.type === 'audio' || raw.type === 'ptt') {
            return MessageType.AUDIO;
        }
        if (raw.type === 'document') {
            return MessageType.DOCUMENT;
        }
        if (raw.type === 'sticker') {
            return MessageType.STICKER;
        }
        if (raw.type === 'location') {
            return MessageType.LOCATION;
        }
        if (raw.type === 'vcard' || raw.type === 'contact') {
            return MessageType.CONTACT;
        }
        if (raw.type === 'revoked') {
            return MessageType.REVOKED;
        }
        if (raw.type === 'poll') {
            return MessageType.POLL;
        }
        if (raw.type === 'reaction') {
            return MessageType.REACTION;
        }
        return MessageType.TEXT;
    }

    // ==========================================
    // Getters (Immutability)
    // ==========================================

    get id(): string { return this.props.id; }
    get chatId(): string { return this.props.chatId; }
    get fromMe(): boolean { return this.props.fromMe; }
    get sender(): string { return this.props.sender; }
    get body(): string { return this.props.body; }
    get type(): MessageType { return this.props.type; }
    get timestamp(): Date { return this.props.timestamp; }
    get ack(): AckLevel { return this.props.ack; }
    get quotedMessageId(): string | undefined { return this.props.quotedMessageId; }
    get mediaUrl(): string | undefined { return this.props.mediaUrl; }
    get isForwarded(): boolean { return this.props.isForwarded; }
    get forwardingScore(): number { return this.props.forwardingScore; }
    get metadata(): Record<string, unknown> { return { ...this.props.metadata }; }

    // ==========================================
    // Domain Logic
    // ==========================================

    /**
     * Check if message is a command (starts with / or !)
     */
    isCommand(): boolean {
        const trimmed = this.props.body.trim();
        return trimmed.startsWith('/') || trimmed.startsWith('!');
    }

    /**
     * Extract command name and arguments
     */
    extractCommand(): { name: string; args: string[]; rawArgs: string } | null {
        if (!this.isCommand()) return null;

        const trimmed = this.props.body.trim();
        const content = trimmed.slice(1); // Remove prefix
        const spaceIndex = content.indexOf(' ');

        if (spaceIndex === -1) {
            return { name: content.toLowerCase(), args: [], rawArgs: '' };
        }

        const name = content.slice(0, spaceIndex).toLowerCase();
        const rawArgs = content.slice(spaceIndex + 1).trim();
        const args = rawArgs.split(/\s+/).filter(Boolean);

        return { name, args, rawArgs };
    }

    /**
     * Get message age in seconds
     */
    getAgeInSeconds(): number {
        return Math.floor((Date.now() - this.props.timestamp.getTime()) / 1000);
    }

    /**
     * Check if message is recent (within threshold)
     */
    isRecent(thresholdSeconds = 300): boolean {
        return this.getAgeInSeconds() < thresholdSeconds;
    }

    /**
     * Check if message has media
     */
    hasMedia(): boolean {
        return [
            MessageType.IMAGE,
            MessageType.VIDEO,
            MessageType.AUDIO,
            MessageType.DOCUMENT,
            MessageType.STICKER,
        ].includes(this.props.type);
    }

    /**
     * Check if message is a reply
     */
    isReply(): boolean {
        return !!this.props.quotedMessageId;
    }

    /**
     * Check if message was heavily forwarded (viral)
     */
    isViral(): boolean {
        return this.props.forwardingScore >= 4;
    }

    /**
     * Get word count
     */
    getWordCount(): number {
        return this.props.body.trim().split(/\s+/).filter(Boolean).length;
    }

    /**
     * Get character count (excluding spaces)
     */
    getCharCount(): number {
        return this.props.body.replace(/\s/g, '').length;
    }

    /**
     * Extract mentions (@number)
     */
    extractMentions(): string[] {
        const mentionRegex = /@(\d+)/g;
        const matches = this.props.body.matchAll(mentionRegex);
        return Array.from(matches, m => m[1]);
    }

    /**
     * Extract URLs
     */
    extractUrls(): string[] {
        const urlRegex = /https?:\/\/[^\s]+/g;
        return this.props.body.match(urlRegex) || [];
    }

    // ==========================================
    // Immutable Updates
    // ==========================================

    /**
     * Create new message with updated ACK level
     */
    withAck(ack: AckLevel): Message {
        return new Message({ ...this.props, ack });
    }

    /**
     * Create new message with additional metadata
     */
    withMetadata(key: string, value: unknown): Message {
        return new Message({
            ...this.props,
            metadata: { ...this.props.metadata, [key]: value },
        });
    }

    // ==========================================
    // Serialization
    // ==========================================

    toJSON(): MessageProps {
        return { ...this.props };
    }

    toString(): string {
        const preview = this.props.body.length > 50
            ? this.props.body.slice(0, 50) + '...'
            : this.props.body;
        return `Message[${this.props.id}]: "${preview}"`;
    }
}
