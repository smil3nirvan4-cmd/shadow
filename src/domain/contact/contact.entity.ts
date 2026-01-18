/**
 * JARVIS ULTIMATE - Contact Entity
 * 
 * Domain model for WhatsApp contacts with profile information.
 */

import { z } from 'zod';
import { ValidationError, Result, ok, fail } from '../../core/errors.js';

// ============================================
// Schema
// ============================================

const ContactSchema = z.object({
    id: z.string().min(1), // Format: 5511999999999@c.us
    name: z.string().optional(),
    pushName: z.string().optional(),
    shortName: z.string().optional(),
    isGroup: z.boolean().default(false),
    isBlocked: z.boolean().default(false),
    isMyContact: z.boolean().default(false),
    isBusiness: z.boolean().default(false),
    profilePicUrl: z.string().url().optional(),
    about: z.string().optional(),
    lastInteraction: z.date().optional(),
    firstInteraction: z.date().optional(),
    totalMessages: z.number().default(0),
    totalCalls: z.number().default(0),
    metadata: z.record(z.unknown()).default({}),
});

export type ContactProps = z.infer<typeof ContactSchema>;

// ============================================
// Entity
// ============================================

export class Contact {
    private constructor(private readonly props: ContactProps) { }

    // ==========================================
    // Factory Method
    // ==========================================

    static create(props: unknown): Result<Contact> {
        const result = ContactSchema.safeParse(props);

        if (!result.success) {
            return fail(
                new ValidationError('Invalid contact data', {
                    errors: result.error.format(),
                })
            );
        }

        return ok(new Contact(result.data));
    }

    static fromRaw(rawContact: Record<string, unknown>): Result<Contact> {
        const props = {
            id: rawContact.id?.['_serialized'] || rawContact.id,
            name: rawContact.name,
            pushName: rawContact.pushname || rawContact.pushName,
            shortName: rawContact.shortName,
            isGroup: rawContact.isGroup ?? false,
            isBlocked: rawContact.isBlocked ?? false,
            isMyContact: rawContact.isMyContact ?? false,
            isBusiness: rawContact.isBusiness ?? false,
            profilePicUrl: rawContact.profilePicUrl,
            about: rawContact.about,
            metadata: {},
        };

        return Contact.create(props);
    }

    // ==========================================
    // Getters
    // ==========================================

    get id(): string { return this.props.id; }
    get name(): string | undefined { return this.props.name; }
    get pushName(): string | undefined { return this.props.pushName; }
    get shortName(): string | undefined { return this.props.shortName; }
    get isGroup(): boolean { return this.props.isGroup; }
    get isBlocked(): boolean { return this.props.isBlocked; }
    get isMyContact(): boolean { return this.props.isMyContact; }
    get isBusiness(): boolean { return this.props.isBusiness; }
    get profilePicUrl(): string | undefined { return this.props.profilePicUrl; }
    get about(): string | undefined { return this.props.about; }
    get lastInteraction(): Date | undefined { return this.props.lastInteraction; }
    get firstInteraction(): Date | undefined { return this.props.firstInteraction; }
    get totalMessages(): number { return this.props.totalMessages; }
    get totalCalls(): number { return this.props.totalCalls; }
    get metadata(): Record<string, unknown> { return { ...this.props.metadata }; }

    // ==========================================
    // Domain Logic
    // ==========================================

    /**
     * Extract phone number from contact ID
     */
    getPhoneNumber(): string {
        return this.props.id.replace('@c.us', '').replace('@g.us', '');
    }

    /**
     * Get formatted phone number (+55 11 99999-9999)
     */
    getFormattedPhoneNumber(): string {
        const number = this.getPhoneNumber();

        // Brazilian number format
        if (number.length === 13 && number.startsWith('55')) {
            return number.replace(
                /^(\d{2})(\d{2})(\d{5})(\d{4})$/,
                '+$1 ($2) $3-$4'
            );
        }

        // Generic format
        return `+${number}`;
    }

    /**
     * Get display name (best available)
     */
    getDisplayName(): string {
        return (
            this.props.name ||
            this.props.pushName ||
            this.props.shortName ||
            this.getFormattedPhoneNumber()
        );
    }

    /**
     * Get initials for avatar
     */
    getInitials(): string {
        const displayName = this.getDisplayName();
        const words = displayName.split(/\s+/).filter(Boolean);

        if (words.length === 0) return '?';
        if (words.length === 1) return words[0].charAt(0).toUpperCase();

        return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
    }

    /**
     * Check if contact is in authorized list
     */
    isAuthorized(authorizedList: string[]): boolean {
        // Check full ID
        if (authorizedList.includes(this.props.id)) return true;

        // Check phone number without suffix
        const phoneNumber = this.getPhoneNumber();
        return authorizedList.some(auth =>
            auth.replace('@c.us', '').replace('@g.us', '') === phoneNumber
        );
    }

    /**
     * Get days since last interaction
     */
    getDaysSinceLastInteraction(): number | null {
        if (!this.props.lastInteraction) return null;

        const diffMs = Date.now() - this.props.lastInteraction.getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * Check if contact is active (interacted recently)
     */
    isActive(thresholdDays = 7): boolean {
        const days = this.getDaysSinceLastInteraction();
        return days !== null && days < thresholdDays;
    }

    /**
     * Check if this is a group chat ID
     */
    isGroupId(): boolean {
        return this.props.id.endsWith('@g.us');
    }

    // ==========================================
    // Immutable Updates
    // ==========================================

    withLastInteraction(date: Date): Contact {
        return new Contact({
            ...this.props,
            lastInteraction: date,
        });
    }

    withTotalMessages(total: number): Contact {
        return new Contact({
            ...this.props,
            totalMessages: total,
        });
    }

    incrementMessages(): Contact {
        return new Contact({
            ...this.props,
            totalMessages: this.props.totalMessages + 1,
            lastInteraction: new Date(),
        });
    }

    incrementCalls(): Contact {
        return new Contact({
            ...this.props,
            totalCalls: this.props.totalCalls + 1,
            lastInteraction: new Date(),
        });
    }

    withMetadata(key: string, value: unknown): Contact {
        return new Contact({
            ...this.props,
            metadata: { ...this.props.metadata, [key]: value },
        });
    }

    withBlocked(blocked: boolean): Contact {
        return new Contact({
            ...this.props,
            isBlocked: blocked,
        });
    }

    // ==========================================
    // Serialization
    // ==========================================

    toJSON(): ContactProps {
        return { ...this.props };
    }

    toString(): string {
        return `Contact[${this.getDisplayName()}]`;
    }
}
