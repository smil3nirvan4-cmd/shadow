/**
 * JARVIS ULTIMATE - Forensics Event Logger
 * 
 * Captures and logs all WhatsApp events for forensic analysis.
 */

import { injectable, inject } from 'tsyringe';
import { EventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { ForensicAnalyzer, WebMessageInfo, ForensicAnalysis } from './protobuf-parser.js';

// ============================================
// Types
// ============================================

export interface PresenceEvent {
    jid: string;
    timestamp: Date;
    presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';
    lastSeen?: Date;
    deviceCount?: number;
}

export interface CallEvent {
    callId: string;
    timestamp: Date;
    type: 'offer' | 'answer' | 'terminate' | 'reject';
    direction: 'incoming' | 'outgoing';
    peer: string;
    mediaType: 'audio' | 'video';
    duration?: number;
    reason?: string;
    deviceInfo?: string;
    ipCandidates?: string[];
}

export interface AckEvent {
    messageId: string;
    timestamp: Date;
    jid: string;
    ackLevel: 'sent' | 'delivered' | 'read' | 'played';
    participant?: string;
}

export interface HistorySyncEvent {
    timestamp: Date;
    chatCount: number;
    messageCount: number;
    contactCount: number;
    dataSize: number;
}

export interface ViewOnceEvent {
    messageId: string;
    timestamp: Date;
    sender: string;
    mediaType: 'image' | 'video' | 'audio';
    wasOpened: boolean;
    bypassAttempt: boolean;
    mediaUrl?: string;
    mediaKey?: string;
}

export interface ForensicsLogEntry {
    id: string;
    timestamp: Date;
    eventType: string;
    data: unknown;
    analysis?: ForensicAnalysis;
}

// ============================================
// In-Memory Storage
// ============================================

const presenceLogs: PresenceEvent[] = [];
const callLogs: CallEvent[] = [];
const ackLogs: AckEvent[] = [];
const viewOnceLogs: ViewOnceEvent[] = [];
const forensicsLog: ForensicsLogEntry[] = [];
const historySyncLogs: HistorySyncEvent[] = [];

const MAX_LOG_SIZE = 10000;

// ============================================
// Forensics Event Logger Service
// ============================================

@injectable()
export class ForensicsEventLogger {
    private isCapturing: boolean = false;

    constructor(
        @inject('EventBus') private eventBus: EventBus,
        @inject('Logger') private logger: Logger,
    ) { }

    // ==========================================
    // Capture Control
    // ==========================================

    startCapture(): void {
        if (this.isCapturing) return;

        this.isCapturing = true;
        this.setupEventListeners();
        this.logger.info('Forensics capture started');
    }

    stopCapture(): void {
        this.isCapturing = false;
        this.logger.info('Forensics capture stopped');
    }

    isActive(): boolean {
        return this.isCapturing;
    }

    // ==========================================
    // Event Listeners
    // ==========================================

    private setupEventListeners(): void {
        // Message events
        this.eventBus.on('message:received', (data) => {
            this.logMessage(data, 'incoming');
        });

        this.eventBus.on('message:sent', (data) => {
            this.logMessage(data, 'outgoing');
        });

        // Presence events (cast to any as these are custom events)
        (this.eventBus as any).on('presence:update', (data: any) => {
            this.logPresence(data);
        });

        // Call events (cast to any as these are custom events)  
        (this.eventBus as any).on('call:offer', (data: any) => {
            this.logCall(data, 'offer');
        });

        (this.eventBus as any).on('call:answer', (data: any) => {
            this.logCall(data, 'answer');
        });

        (this.eventBus as any).on('call:terminate', (data: any) => {
            this.logCall(data, 'terminate');
        });

        // Ack events
        this.eventBus.on('message:ack', (data) => {
            this.logAck(data as any);
        });

        // History sync (cast to any as this is a custom event)
        (this.eventBus as any).on('history:sync', (data: any) => {
            this.logHistorySync(data);
        });

        // ViewOnce events (cast to any as this is a custom event)
        (this.eventBus as any).on('message:viewonce', (data: any) => {
            this.logViewOnce(data);
        });
    }

    // ==========================================
    // Logging Methods
    // ==========================================

    private logMessage(data: unknown, direction: string): void {
        if (!this.isCapturing) return;

        const entry: ForensicsLogEntry = {
            id: this.generateId(),
            timestamp: new Date(),
            eventType: `message:${direction}`,
            data,
        };

        // Run forensic analysis if we have WebMessageInfo structure
        if (this.isWebMessageInfo(data)) {
            entry.analysis = ForensicAnalyzer.analyze(data);
        }

        this.addToLog(forensicsLog, entry);

        // Log anomalies
        if (entry.analysis?.isManipulated) {
            this.logger.warn({
                messageId: entry.analysis.messageId,
                anomalies: entry.analysis.anomalies,
            }, 'Message manipulation detected');
        }
    }

    private logPresence(data: { jid: string; presence: string; lastSeen?: number }): void {
        if (!this.isCapturing) return;

        const event: PresenceEvent = {
            jid: data.jid,
            timestamp: new Date(),
            presence: data.presence as PresenceEvent['presence'],
            lastSeen: data.lastSeen ? new Date(data.lastSeen * 1000) : undefined,
        };

        this.addToLog(presenceLogs, event);
    }

    private logCall(data: {
        callId: string;
        peer: string;
        type: string;
        duration?: number;
        reason?: string;
        ipCandidates?: string[];
    }, eventType: string): void {
        if (!this.isCapturing) return;

        const event: CallEvent = {
            callId: data.callId,
            timestamp: new Date(),
            type: eventType as CallEvent['type'],
            direction: data.type === 'offer' ? 'incoming' : 'outgoing',
            peer: data.peer,
            mediaType: 'audio', // Default, can be detected from SDP
            duration: data.duration,
            reason: data.reason,
            ipCandidates: data.ipCandidates,
        };

        this.addToLog(callLogs, event);
    }

    private logAck(data: { messageId: string; jid: string; ack: number; participant?: string }): void {
        if (!this.isCapturing) return;

        const ackLevels: Record<number, AckEvent['ackLevel']> = {
            1: 'sent',
            2: 'delivered',
            3: 'read',
            4: 'played',
        };

        const event: AckEvent = {
            messageId: data.messageId,
            timestamp: new Date(),
            jid: data.jid,
            ackLevel: ackLevels[data.ack] || 'sent',
            participant: data.participant,
        };

        this.addToLog(ackLogs, event);
    }

    private logHistorySync(data: { chats?: unknown[]; messages?: unknown[]; contacts?: unknown[] }): void {
        if (!this.isCapturing) return;

        const event: HistorySyncEvent = {
            timestamp: new Date(),
            chatCount: data.chats?.length || 0,
            messageCount: data.messages?.length || 0,
            contactCount: data.contacts?.length || 0,
            dataSize: JSON.stringify(data).length,
        };

        this.addToLog(historySyncLogs, event);
        this.logger.info({ event }, 'History sync captured');
    }

    private logViewOnce(data: {
        messageId: string;
        sender: string;
        type: string;
        opened: boolean;
        bypass: boolean;
        url?: string;
        key?: string;
    }): void {
        if (!this.isCapturing) return;

        const event: ViewOnceEvent = {
            messageId: data.messageId,
            timestamp: new Date(),
            sender: data.sender,
            mediaType: data.type as ViewOnceEvent['mediaType'],
            wasOpened: data.opened,
            bypassAttempt: data.bypass,
            mediaUrl: data.url,
            mediaKey: data.key,
        };

        this.addToLog(viewOnceLogs, event);

        if (data.bypass) {
            this.logger.warn({ messageId: data.messageId }, 'ViewOnce bypass detected');
        }
    }

    // ==========================================
    // Data Access
    // ==========================================

    getPresenceLogs(limit: number = 100): PresenceEvent[] {
        return presenceLogs.slice(-limit);
    }

    getCallLogs(limit: number = 100): CallEvent[] {
        return callLogs.slice(-limit);
    }

    getAckLogs(limit: number = 100): AckEvent[] {
        return ackLogs.slice(-limit);
    }

    getViewOnceLogs(limit: number = 100): ViewOnceEvent[] {
        return viewOnceLogs.slice(-limit);
    }

    getForensicsLog(limit: number = 100): ForensicsLogEntry[] {
        return forensicsLog.slice(-limit);
    }

    getHistorySyncLogs(): HistorySyncEvent[] {
        return [...historySyncLogs];
    }

    getAnomalies(): ForensicsLogEntry[] {
        return forensicsLog.filter(e => e.analysis?.isManipulated);
    }

    // ==========================================
    // Statistics
    // ==========================================

    getStats(): {
        presenceCount: number;
        callCount: number;
        ackCount: number;
        viewOnceCount: number;
        anomalyCount: number;
        historySyncs: number;
    } {
        return {
            presenceCount: presenceLogs.length,
            callCount: callLogs.length,
            ackCount: ackLogs.length,
            viewOnceCount: viewOnceLogs.length,
            anomalyCount: forensicsLog.filter(e => e.analysis?.isManipulated).length,
            historySyncs: historySyncLogs.length,
        };
    }

    // ==========================================
    // Presence Timeline
    // ==========================================

    getPresenceTimeline(jid: string, hoursBack: number = 24): { hour: number; count: number; lastSeen?: string }[] {
        const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);
        const filtered = presenceLogs.filter(e => e.jid === jid && e.timestamp.getTime() > cutoff);

        const byHour = new Map<number, { count: number; lastSeen?: Date }>();

        for (const event of filtered) {
            const hour = event.timestamp.getHours();
            const existing = byHour.get(hour) || { count: 0 };
            existing.count++;
            if (event.lastSeen) existing.lastSeen = event.lastSeen;
            byHour.set(hour, existing);
        }

        return Array.from(byHour.entries())
            .map(([hour, data]) => ({
                hour,
                count: data.count,
                lastSeen: data.lastSeen?.toISOString(),
            }))
            .sort((a, b) => a.hour - b.hour);
    }

    // ==========================================
    // Utilities
    // ==========================================

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    private addToLog<T>(log: T[], entry: T): void {
        log.push(entry);
        if (log.length > MAX_LOG_SIZE) {
            log.shift();
        }
    }

    private isWebMessageInfo(data: unknown): data is WebMessageInfo {
        return typeof data === 'object' && data !== null && 'key' in data;
    }

    clearLogs(): void {
        presenceLogs.length = 0;
        callLogs.length = 0;
        ackLogs.length = 0;
        viewOnceLogs.length = 0;
        forensicsLog.length = 0;
        historySyncLogs.length = 0;
        this.logger.info('Forensics logs cleared');
    }
}
