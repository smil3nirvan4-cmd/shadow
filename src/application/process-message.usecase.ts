/**
 * JARVIS ULTIMATE - Process Message Use Case
 * 
 * Main orchestration for message processing.
 * Replaces the monolithic processarMensagem function.
 */

import { injectable, inject } from 'tsyringe';
import { Message } from '../domain/message/message.entity.js';
import { Contact } from '../domain/contact/contact.entity.js';
import { AIService } from '../domain/ai/ai.service.js';
import {
    MessageRepository,
    ContactRepository,
    BehaviorProfileRepository
} from '../domain/shared/repository.interface.js';
import { BehaviorProfile } from '../domain/analytics/behavior-profile.entity.js';
import { EventBus } from '../core/event-bus.js';
import { Config } from '../core/config.js';
import { Logger } from '../core/logger.js';
import { Result, ok, fail, AuthorizationError } from '../core/errors.js';

// ============================================
// Input/Output Types
// ============================================

export interface ProcessMessageInput {
    rawMessage: Record<string, unknown>;
}

export interface MessageAnalytics {
    processingTimeMs: number;
    aiLatencyMs?: number;
    cached: boolean;
    wordCount: number;
    isCommand: boolean;
}

export interface ProcessMessageOutput {
    message: Message;
    contact: Contact;
    shouldRespond: boolean;
    response?: string;
    command?: { name: string; args: string[]; result: unknown };
    analytics: MessageAnalytics;
}

// ============================================
// Use Case
// ============================================

@injectable()
export class ProcessMessageUseCase {
    constructor(
        @inject('MessageRepository') private messageRepo: MessageRepository,
        @inject('ContactRepository') private contactRepo: ContactRepository,
        @inject('BehaviorProfileRepository') private profileRepo: BehaviorProfileRepository,
        @inject('AIService') private aiService: AIService,
        @inject('EventBus') private eventBus: EventBus,
        @inject('Config') private config: Config,
        @inject('Logger') private logger: Logger,
    ) { }

    async execute(input: ProcessMessageInput): Promise<Result<ProcessMessageOutput>> {
        const startTime = Date.now();
        let aiLatencyMs: number | undefined;
        let cached = false;

        // 1. Parse and validate message
        const messageResult = Message.fromRaw(input.rawMessage);
        if (!messageResult.success) {
            return fail(messageResult.error);
        }
        const message = messageResult.data;

        this.logger.debug({ messageId: message.id, body: message.body.slice(0, 50) }, 'Processing message');

        // 2. Get or create contact
        const contact = await this.getOrCreateContact(message.sender);

        // 3. Check authorization
        if (!this.isAuthorized(message.sender)) {
            this.logger.warn({ sender: message.sender }, 'Unauthorized sender');
            return fail(new AuthorizationError('Sender not authorized', {
                sender: message.sender,
            }));
        }

        // 4. Save message
        await this.messageRepo.save(message);

        // 5. Update contact interaction
        await this.contactRepo.updateLastInteraction(contact.id, new Date());

        // 6. Update behavior profile
        await this.updateBehaviorProfile(message, contact);

        // 7. Emit event
        this.eventBus.emit('message:received', {
            message: {
                id: message.id,
                chatId: message.chatId,
                body: message.body,
                fromMe: message.fromMe,
                timestamp: message.timestamp,
            },
            contact: {
                id: contact.id,
                name: contact.name,
                pushName: contact.pushName,
            },
            timestamp: new Date(),
        });

        // 8. Check if should respond
        if (message.fromMe) {
            return ok({
                message,
                contact,
                shouldRespond: false,
                analytics: this.buildAnalytics(startTime, message, false),
            });
        }

        // 9. Check if command
        if (message.isCommand()) {
            const command = message.extractCommand();
            if (command) {
                this.logger.info({ command: command.name }, 'Command detected');

                // Commands handled separately
                return ok({
                    message,
                    contact,
                    shouldRespond: false,
                    command: { ...command, result: null },
                    analytics: this.buildAnalytics(startTime, message, false),
                });
            }
        }

        // 10. Generate AI response
        const aiStartTime = Date.now();
        const context = await this.buildAIContext(message, contact);
        const aiResult = await this.aiService.generateResponse({
            prompt: message.body,
            conversationHistory: context,
        });

        aiLatencyMs = Date.now() - aiStartTime;

        if (!aiResult.success) {
            this.logger.error({ error: aiResult.error }, 'AI generation failed');
            return ok({
                message,
                contact,
                shouldRespond: false,
                analytics: this.buildAnalytics(startTime, message, false, aiLatencyMs),
            });
        }

        cached = aiResult.data.cached;

        return ok({
            message,
            contact,
            shouldRespond: true,
            response: aiResult.data.content,
            analytics: this.buildAnalytics(startTime, message, cached, aiLatencyMs),
        });
    }

    // ==========================================
    // Private Methods
    // ==========================================

    private isAuthorized(sender: string): boolean {
        const authorizedNumbers = this.config.whatsapp.authorizedNumbers;

        // Empty list = all authorized (dev mode)
        if (authorizedNumbers.length === 0) return true;

        const phoneNumber = sender.replace('@c.us', '').replace('@g.us', '');

        return authorizedNumbers.some(auth => {
            const authNumber = auth.replace('@c.us', '').replace('@g.us', '');
            return authNumber === phoneNumber || auth === sender;
        });
    }

    private async getOrCreateContact(contactId: string): Promise<Contact> {
        let contact = await this.contactRepo.findByPhoneNumber(
            contactId.replace('@c.us', '')
        );

        if (!contact) {
            const result = Contact.create({
                id: contactId,
                firstInteraction: new Date(),
            });

            if (result.success) {
                contact = (result as { success: true; data: Contact }).data;
                await this.contactRepo.save(contact);
            } else {
                // Fallback
                const fallback = Contact.create({ id: contactId });
                contact = fallback.success ? (fallback as { success: true; data: Contact }).data : null as unknown as Contact;
            }
        }

        return contact;
    }

    private async updateBehaviorProfile(
        _message: Message,
        contact: Contact
    ): Promise<void> {
        try {
            let profile = await this.profileRepo.findByContact(contact.id);

            if (!profile) {
                profile = BehaviorProfile.empty(contact.id);
            }

            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();

            const updated = (profile as any).recordInteraction?.(hour, day) || profile;
            await this.profileRepo.save(updated);
        } catch (error) {
            this.logger.error({ error }, 'Failed to update behavior profile');
        }
    }

    private async buildAIContext(
        message: Message,
        _contact: Contact
    ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
        try {
            const recent = await this.messageRepo.findRecent(message.chatId, 10);

            return recent
                .filter(m => m.id !== message.id)
                .map(m => ({
                    role: m.fromMe ? 'assistant' as const : 'user' as const,
                    content: m.body,
                }));
        } catch {
            return [];
        }
    }

    private buildAnalytics(
        startTime: number,
        message: Message,
        cached: boolean,
        aiLatencyMs?: number
    ): MessageAnalytics {
        return {
            processingTimeMs: Date.now() - startTime,
            aiLatencyMs,
            cached,
            wordCount: message.getWordCount(),
            isCommand: message.isCommand(),
        };
    }
}
