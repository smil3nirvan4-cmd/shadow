/**
 * JARVIS ULTIMATE - WhatsApp Client
 * 
 * Wrapper for whatsapp-web.js with event handling.
 */

import { injectable, inject } from 'tsyringe';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import { EventBus, AckLevel } from '../../core/event-bus.js';
import { Config } from '../../core/config.js';
import { Logger } from '../../core/logger.js';
import { Result, ok, fail, WhatsAppConnectionError } from '../../core/errors.js';

// ============================================
// Types
// ============================================

export interface SendMessageOptions {
    quotedMessageId?: string;
    mentions?: string[];
}

// ============================================
// WhatsApp Client
// ============================================

@injectable()
export class WhatsAppClient {
    private client: InstanceType<typeof Client> | null = null;
    private isReady = false;
    private isInitializing = false;

    constructor(
        @inject('Config') private config: Config,
        @inject('EventBus') private eventBus: EventBus,
        @inject('Logger') private logger: Logger,
    ) { }

    // ==========================================
    // Lifecycle
    // ==========================================

    async initialize(): Promise<void> {
        if (this.isInitializing || this.isReady) {
            this.logger.warn('WhatsApp client already initializing or ready');
            return;
        }

        this.isInitializing = true;
        this.logger.info('Initializing WhatsApp client...');

        try {
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: this.config.whatsapp.sessionPath,
                }),
                puppeteer: {
                    headless: this.config.whatsapp.puppeteer.headless,
                    args: this.config.whatsapp.puppeteer.args,
                    executablePath: this.config.whatsapp.puppeteer.executablePath,
                },
            });

            this.setupEventHandlers();
            await this.client.initialize();
        } catch (error) {
            this.isInitializing = false;
            throw new WhatsAppConnectionError('Failed to initialize WhatsApp client', {
                error: String(error),
            });
        }
    }

    async destroy(): Promise<void> {
        if (this.client) {
            this.logger.info('Destroying WhatsApp client...');
            await this.client.destroy();
            this.client = null;
            this.isReady = false;
        }
    }

    // ==========================================
    // State
    // ==========================================

    isConnected(): boolean {
        return this.isReady;
    }

    async getState(): Promise<string> {
        if (!this.client) return 'DISCONNECTED';
        try {
            return await this.client.getState() || 'UNKNOWN';
        } catch {
            return 'ERROR';
        }
    }

    // ==========================================
    // Messaging
    // ==========================================

    async sendMessage(
        chatId: string,
        content: string,
        options?: SendMessageOptions
    ): Promise<Result<string>> {
        if (!this.client || !this.isReady) {
            return fail(new WhatsAppConnectionError('Client not ready'));
        }

        try {
            const startTime = Date.now();

            const msg = await this.client.sendMessage(chatId, content, {
                quotedMessageId: options?.quotedMessageId,
                mentions: options?.mentions,
            });

            const latencyMs = Date.now() - startTime;
            const messageId = msg.id._serialized;

            this.eventBus.emit('message:sent', {
                messageId,
                chatId,
                latencyMs,
            });

            return ok(messageId);
        } catch (error) {
            return fail(new WhatsAppConnectionError('Failed to send message', {
                error: String(error),
                chatId,
            }));
        }
    }

    async reply(
        originalMessage: { id: { _serialized: string }; from: string },
        content: string
    ): Promise<Result<string>> {
        return this.sendMessage(originalMessage.from, content, {
            quotedMessageId: originalMessage.id._serialized,
        });
    }

    async sendMedia(
        chatId: string,
        mediaPath: string,
        caption?: string
    ): Promise<Result<string>> {
        if (!this.client || !this.isReady) {
            return fail(new WhatsAppConnectionError('Client not ready'));
        }

        try {
            const media = MessageMedia.fromFilePath(mediaPath);
            const msg = await this.client.sendMessage(chatId, media, { caption });
            return ok(msg.id._serialized);
        } catch (error) {
            return fail(new WhatsAppConnectionError('Failed to send media', {
                error: String(error),
            }));
        }
    }

    // ==========================================
    // Contacts
    // ==========================================

    async getContact(contactId: string): Promise<unknown | null> {
        if (!this.client) return null;
        try {
            return await this.client.getContactById(contactId);
        } catch {
            return null;
        }
    }

    async getProfilePicUrl(contactId: string): Promise<string | null> {
        if (!this.client) return null;
        try {
            return await this.client.getProfilePicUrl(contactId);
        } catch {
            return null;
        }
    }

    // ==========================================
    // Chats
    // ==========================================

    async getChat(chatId: string): Promise<unknown | null> {
        if (!this.client) return null;
        try {
            return await this.client.getChatById(chatId);
        } catch {
            return null;
        }
    }

    async getChats(): Promise<unknown[]> {
        if (!this.client) return [];
        try {
            return await this.client.getChats();
        } catch {
            return [];
        }
    }

    // ==========================================
    // Internal Client (for advanced operations)
    // ==========================================

    getInternalClient(): InstanceType<typeof Client> | null {
        return this.client;
    }

    // ==========================================
    // QR Code & Connection Management
    // ==========================================

    private lastQRCode: string | null = null;

    /**
     * Get QR Code as base64 for dashboard display
     */
    getQRCodeBase64(): string | null {
        return this.lastQRCode;
    }

    /**
     * Get connection info
     */
    async getConnectionInfo(): Promise<{
        connected: boolean;
        state: string;
        pushName?: string;
        phoneNumber?: string;
    }> {
        if (!this.client || !this.isReady) {
            return { connected: false, state: 'DISCONNECTED' };
        }

        try {
            const info = this.client.info;
            return {
                connected: true,
                state: await this.getState(),
                pushName: info?.pushname,
                phoneNumber: info?.wid?.user,
            };
        } catch {
            return { connected: false, state: 'ERROR' };
        }
    }

    /**
     * Logout and clear session
     */
    async logout(): Promise<void> {
        if (this.client) {
            await this.client.logout();
            this.isReady = false;
            this.lastQRCode = null;
        }
    }

    // ==========================================
    // Contacts Management
    // ==========================================

    async getAllContacts(): Promise<unknown[]> {
        if (!this.client || !this.isReady) return [];
        try {
            return await this.client.getContacts();
        } catch {
            return [];
        }
    }

    async getContactInfo(contactId: string): Promise<{
        id: string;
        name: string;
        pushname?: string;
        isGroup: boolean;
        isBlocked: boolean;
        profilePic?: string;
    } | null> {
        if (!this.client || !this.isReady) return null;

        try {
            const contact = await this.client.getContactById(contactId);
            const profilePic = await this.getProfilePicUrl(contactId);

            return {
                id: contact.id._serialized,
                name: contact.name || contact.pushname || contact.id.user,
                pushname: contact.pushname,
                isGroup: contact.isGroup,
                isBlocked: contact.isBlocked,
                profilePic: profilePic || undefined,
            };
        } catch {
            return null;
        }
    }

    // ==========================================
    // Presence & Status
    // ==========================================

    async subscribePresence(contactId: string): Promise<boolean> {
        if (!this.client || !this.isReady) return false;

        try {
            const chat = await this.client.getChatById(contactId);
            // Presence subscription handled differently in whatsapp-web.js
            // The library automatically subscribes when you fetch the chat
            return true;
        } catch {
            return false;
        }
    }

    async setPresence(_presence: 'available' | 'unavailable'): Promise<boolean> {
        if (!this.client || !this.isReady) return false;

        try {
            await this.client.sendPresenceAvailable();
            return true;
        } catch {
            return false;
        }
    }

    // ==========================================
    // Messages
    // ==========================================

    async getMessagesFromChat(chatId: string, limit: number = 50): Promise<unknown[]> {
        if (!this.client || !this.isReady) return [];

        try {
            const chat = await this.client.getChatById(chatId);
            return await chat.fetchMessages({ limit });
        } catch {
            return [];
        }
    }

    async markAsRead(chatId: string): Promise<boolean> {
        if (!this.client || !this.isReady) return false;

        try {
            const chat = await this.client.getChatById(chatId);
            await chat.sendSeen();
            return true;
        } catch {
            return false;
        }
    }

    // ==========================================
    // Event Handlers
    // ==========================================

    private setupEventHandlers(): void {
        if (!this.client) return;

        // QR Code
        this.client.on('qr', (qr: string) => {
            this.logger.info('QR Code received, scan to authenticate');
            this.lastQRCode = qr; // Save for API access
            qrcode.generate(qr, { small: true });
            this.eventBus.emit('whatsapp:qr', { qr });
        });

        // Authenticated
        this.client.on('authenticated', () => {
            this.logger.info('WhatsApp authenticated');
            this.eventBus.emit('whatsapp:authenticated', {
                sessionId: 'default'
            });
        });

        // Ready
        this.client.on('ready', () => {
            this.isReady = true;
            this.isInitializing = false;
            this.logger.info('WhatsApp client is ready!');
        });

        // Disconnected
        this.client.on('disconnected', (reason: string) => {
            this.isReady = false;
            this.logger.warn({ reason }, 'WhatsApp disconnected');
            this.eventBus.emit('whatsapp:disconnected', { reason });
        });

        // Message
        this.client.on('message_create', async (msg: unknown) => {
            try {
                const message = msg as Record<string, unknown>;

                // Import use case dynamically to avoid circular deps
                const { container } = await import('tsyringe');
                const { ProcessMessageUseCase } = await import('../../application/process-message.usecase.js');

                const useCase = container.resolve(ProcessMessageUseCase);
                const result = await useCase.execute({ rawMessage: message });

                if (result.success && result.data.shouldRespond && result.data.response) {
                    await this.reply(
                        message as { id: { _serialized: string }; from: string },
                        result.data.response
                    );
                }
            } catch (error) {
                this.logger.error({ error }, 'Error processing message');
            }
        });

        // Message ACK
        this.client.on('message_ack', (msg: unknown, ack: number) => {
            const message = msg as { id: { _serialized: string } };
            this.eventBus.emit('message:ack', {
                messageId: message.id._serialized,
                ackLevel: ack as AckLevel,
                readAt: ack >= 3 ? new Date() : undefined,
            });
        });

        // Incoming call
        this.client.on('incoming_call', async (call: unknown) => {
            this.logger.info({ call }, 'Incoming call');
            // Will be handled by ProcessCallUseCase
        });
    }
}
