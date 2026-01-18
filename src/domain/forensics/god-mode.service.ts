/**
 * JARVIS ULTIMATE - God Mode Service
 * 
 * Baseado no código REAL de god_mode.js
 * Implementa: ACK spy, call interceptor, anti-delete, presence spoofing
 */

import { injectable } from 'tsyringe';
import { EventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { GodModeConfig } from '../../domain/forensics/god-mode-config.entity.js';

// ============================================
// Types (do original)
// ============================================

export interface AckLog {
    msgId: string;
    to: string;
    from: string;
    ack: number;
    ackName: string;
    timestamp: Date;
    preview: string;
    latencyMs?: number;
}

export interface CallLog {
    id: string;
    from: string;
    type: 'voice' | 'video';
    isGroup: boolean;
    timestamp: Date;
    action: 'received' | 'rejected' | 'missed' | 'answered';
    duration?: number;
}

export interface ReactionLog {
    msgId: string;
    from: string;
    emoji: string;
    timestamp: Date;
    read: boolean;
}

export interface DeletedMessage {
    id: string;
    chatId: string;
    from: string;
    body: string;
    type: string;
    timestamp: Date;
    deletedAt: Date;
    hasMedia: boolean;
    mediaPath?: string;
}

export interface PresenceLog {
    contactId: string;
    status: 'online' | 'offline' | 'typing' | 'recording';
    timestamp: Date;
    duration?: number;
}

export interface ViewOnceMedia {
    id: string;
    chatId: string;
    from: string;
    type: string;
    savedPath: string;
    timestamp: Date;
}

// ============================================
// Service
// ============================================

@injectable()
export class GodModeService {
    private config: GodModeConfig;

    // In-memory logs (em produção seria em SQLite)
    private ackLogs: AckLog[] = [];
    private callLogs: CallLog[] = [];
    private reactionLogs: ReactionLog[] = [];
    private deletedMessages: DeletedMessage[] = [];
    private presenceLogs: Map<string, PresenceLog[]> = new Map();
    private viewOnceMedia: ViewOnceMedia[] = [];

    // Latency tracking (do original)
    private latencyTracker: Map<string, { sentAt: Date }> = new Map();

    private readonly MAX_LOGS = 500;

    constructor(
        private readonly eventBus: EventBus,
        private readonly logger: Logger,
    ) {
        this.config = GodModeConfig.default();
        this.setupEventListeners();
    }

    // ==========================================
    // Config Management
    // ==========================================

    getConfig(): GodModeConfig {
        return this.config;
    }

    updateConfig(changes: Partial<ReturnType<GodModeConfig['toJSON']>>): GodModeConfig {
        this.config = this.config.update(changes);
        this.logger.info(this.config.toSummary(), '[GodMode] Config updated');
        return this.config;
    }

    // ==========================================
    // ACK SPY (do original processarMessageAck)
    // ==========================================

    processMessageAck(msg: { id: string; to: string; from: string; body?: string; fromMe?: boolean }, ackLevel: number): AckLog | null {
        const ackNames = ['ERROR', 'SENT', 'RECEIVED', 'READ', 'PLAYED'];

        const log: AckLog = {
            msgId: msg.id,
            to: msg.to,
            from: msg.from,
            ack: ackLevel,
            ackName: ackNames[ackLevel] || 'UNKNOWN',
            timestamp: new Date(),
            preview: (msg.body || '').substring(0, 50),
        };

        // Track latency if we sent this message
        if (msg.fromMe && ackLevel >= 2) {
            const tracked = this.latencyTracker.get(msg.id);
            if (tracked) {
                log.latencyMs = Date.now() - tracked.sentAt.getTime();
                this.latencyTracker.delete(msg.id);
            }
        }

        // Only log READ (3) or PLAYED (4)
        if (ackLevel >= 3) {
            this.addLog(this.ackLogs, log);
            this.logger.debug(`[GodMode] 👁️ Message ${log.ackName}: ${log.preview}...`);

            this.eventBus.emit('godmode:ack', { log });
        }

        return log;
    }

    trackMessageSent(msgId: string): void {
        this.latencyTracker.set(msgId, { sentAt: new Date() });

        // Cleanup após 1 hora
        setTimeout(() => this.latencyTracker.delete(msgId), 3600000);
    }

    getAckLogs(limit = 100): AckLog[] {
        return this.ackLogs.slice(0, limit);
    }

    // ==========================================
    // CALL INTERCEPTOR (do original processarChamadaRecebida)
    // ==========================================

    async processIncomingCall(
        call: { id: string; peerJid: string; isVideo: boolean; isGroup: boolean },
        client?: { sendMessage: (to: string, msg: string) => Promise<void> },
    ): Promise<CallLog> {
        const log: CallLog = {
            id: call.id,
            from: call.peerJid,
            type: call.isVideo ? 'video' : 'voice',
            isGroup: call.isGroup,
            timestamp: new Date(),
            action: 'received',
        };

        this.addLog(this.callLogs, log);
        this.logger.info(`[GodMode] 📞 ${log.type} call from ${log.from}`);

        // Auto reject if enabled
        if (this.config.autoRejectCalls && client) {
            try {
                log.action = 'rejected';
                await client.sendMessage(call.peerJid, this.config.callRejectMessage);
                this.logger.info('[GodMode] 🚫 Call auto-rejected');
            } catch (e) {
                this.logger.error({ error: e }, '[GodMode] Failed to reject call');
            }
        }

        this.eventBus.emit('godmode:call', { log });
        return log;
    }

    getCallLogs(limit = 100): CallLog[] {
        return this.callLogs.slice(0, limit);
    }

    // ==========================================
    // REACTION SPY (do original processarReacao)
    // ==========================================

    processReaction(reaction: { msgId: string; senderId: string; reaction: string; read?: boolean }): ReactionLog {
        const log: ReactionLog = {
            msgId: reaction.msgId,
            from: reaction.senderId,
            emoji: reaction.reaction,
            timestamp: new Date(),
            read: reaction.read || false,
        };

        if (this.config.reactionSpy) {
            this.addLog(this.reactionLogs, log);
            this.logger.debug(`[GodMode] 😂 Reaction ${log.emoji} from ${log.from}`);

            this.eventBus.emit('godmode:reaction', { log });
        }

        return log;
    }

    getReactionLogs(limit = 100): ReactionLog[] {
        return this.reactionLogs.slice(0, limit);
    }

    // ==========================================
    // ANTI-DELETE (do original)
    // ==========================================

    captureMessageBeforeDelete(msg: {
        id: string;
        from: string;
        to: string;
        body: string;
        type: string;
        hasMedia: boolean;
        timestamp: number;
    }): DeletedMessage | null {
        if (!this.config.antiDelete) {
            return null;
        }

        const deleted: DeletedMessage = {
            id: msg.id,
            chatId: msg.to,
            from: msg.from,
            body: msg.body,
            type: msg.type,
            timestamp: new Date(msg.timestamp * 1000),
            deletedAt: new Date(),
            hasMedia: msg.hasMedia,
        };

        this.addLog(this.deletedMessages, deleted);
        this.logger.warn(`[GodMode] 🗑️ Captured deleted message from ${msg.from}`);

        this.eventBus.emit('godmode:message_deleted', { message: deleted });
        return deleted;
    }

    getDeletedMessages(limit = 100): DeletedMessage[] {
        return this.deletedMessages.slice(0, limit);
    }

    // ==========================================
    // STALKING / PRESENCE (do original)
    // ==========================================

    addStalkTarget(contactId: string): void {
        this.config = this.config.addStalkTarget(contactId);
        this.logger.info(`[GodMode] 🥷 Now stalking: ${contactId}`);
        this.eventBus.emit('godmode:stalk_added', { contactId });
    }

    removeStalkTarget(contactId: string): void {
        this.config = this.config.removeStalkTarget(contactId);
        this.logger.info(`[GodMode] 🥷 Stopped stalking: ${contactId}`);
        this.eventBus.emit('godmode:stalk_removed', { contactId });
    }

    getStalkTargets(): string[] {
        return this.config.stalking;
    }

    processPresenceUpdate(contactId: string, status: 'online' | 'offline' | 'typing' | 'recording'): PresenceLog | null {
        if (!this.config.presenceSpy && !this.config.isStalkingContact(contactId)) {
            return null;
        }

        const log: PresenceLog = {
            contactId,
            status,
            timestamp: new Date(),
        };

        // Calculate duration if going offline
        const contactLogs = this.presenceLogs.get(contactId) || [];
        if (status === 'offline' && contactLogs.length > 0) {
            const lastOnline = contactLogs.find(l => l.status === 'online');
            if (lastOnline) {
                log.duration = Date.now() - lastOnline.timestamp.getTime();
            }
        }

        contactLogs.unshift(log);
        if (contactLogs.length > 100) contactLogs.pop();
        this.presenceLogs.set(contactId, contactLogs);

        this.logger.debug(`[GodMode] 📡 ${contactId} is now ${status}`);

        if (this.config.isStalkingContact(contactId)) {
            this.eventBus.emit('godmode:presence_update', { log });
        }

        return log;
    }

    getPresenceLogs(contactId: string, limit = 50): PresenceLog[] {
        return (this.presenceLogs.get(contactId) || []).slice(0, limit);
    }

    getAllPresenceLogs(limit = 100): PresenceLog[] {
        const all: PresenceLog[] = [];
        this.presenceLogs.forEach(logs => all.push(...logs));
        return all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
    }

    // ==========================================
    // VIEW ONCE BYPASS (do original)
    // ==========================================

    async processViewOnceMessage(msg: {
        id: string;
        from: string;
        to: string;
        type: string;
        downloadMedia?: () => Promise<{ data: string; mimetype: string }>;
    }): Promise<ViewOnceMedia | null> {
        if (!this.config.viewOnceBypass || !msg.downloadMedia) {
            return null;
        }

        try {
            const media = await msg.downloadMedia();

            // Em produção, salvar arquivo real
            const savedPath = `./data/viewonce/${msg.id}.${this.getExtension(media.mimetype)}`;

            const record: ViewOnceMedia = {
                id: msg.id,
                chatId: msg.to,
                from: msg.from,
                type: msg.type,
                savedPath,
                timestamp: new Date(),
            };

            this.addLog(this.viewOnceMedia, record);
            this.logger.info(`[GodMode] 👀 Saved view-once from ${msg.from}`);

            this.eventBus.emit('godmode:viewonce_saved', { record });
            return record;
        } catch (e) {
            this.logger.error({ error: e }, '[GodMode] Failed to save view-once');
            return null;
        }
    }

    getViewOnceHistory(limit = 50): ViewOnceMedia[] {
        return this.viewOnceMedia.slice(0, limit);
    }

    // ==========================================
    // GHOST MODE (do original)
    // ==========================================

    isGhostModeEnabled(): boolean {
        return this.config.ghostMode;
    }

    setGhostMode(enabled: boolean): void {
        this.config = this.config.setGhostMode(enabled);
        this.logger.info(`[GodMode] 👻 Ghost mode: ${enabled ? 'ON' : 'OFF'}`);
        this.eventBus.emit('godmode:ghost_mode', { enabled });
    }

    // ==========================================
    // STATUS (do original)
    // ==========================================

    getStatus(): {
        config: ReturnType<GodModeConfig['toSummary']>;
        stats: {
            ackLogs: number;
            callLogs: number;
            reactionLogs: number;
            deletedMessages: number;
            stalkTargets: number;
            viewOnceMedia: number;
        };
    } {
        return {
            config: this.config.toSummary(),
            stats: {
                ackLogs: this.ackLogs.length,
                callLogs: this.callLogs.length,
                reactionLogs: this.reactionLogs.length,
                deletedMessages: this.deletedMessages.length,
                stalkTargets: this.config.stalking.length,
                viewOnceMedia: this.viewOnceMedia.length,
            },
        };
    }

    // ==========================================
    // Helpers
    // ==========================================

    private addLog<T>(logs: T[], entry: T): void {
        logs.unshift(entry);
        if (logs.length > this.MAX_LOGS) logs.pop();
    }

    private getExtension(mimetype: string): string {
        const map: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'video/mp4': 'mp4',
            'audio/ogg': 'ogg',
        };
        return map[mimetype] || 'bin';
    }

    private setupEventListeners(): void {
        // Podemos escutar eventos globais aqui se necessário
    }
}
