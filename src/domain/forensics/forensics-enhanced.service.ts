/**
 * JARVIS ULTIMATE - Forensics Enhanced Service
 * 
 * Baseado no código REAL de forensics_enhanced.js
 * Implementa: timezone inference, device fingerprinting, media metadata
 */

import { injectable } from 'tsyringe';
import { EventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';

// ============================================
// Types (do original)
// ============================================

export interface EnhancedCallLog {
    id: string;
    from: string;
    type: 'voice' | 'video';
    isGroup: boolean;
    timestamp: Date;
    action: string;

    // Enhanced fields (do original)
    localTime: string;
    dayOfWeek: string;
    inferredTimezone: string | null;
    inferredLocation: string | null;
    duration: number | null;
    protocol: string;
    quality: string;
}

export interface PresencePattern {
    contactId: string;

    // Activity windows (do original)
    mostActiveHours: number[];
    leastActiveHours: number[];
    avgOnlineDuration: number;
    avgOfflineDuration: number;

    // Inferred data
    inferredTimezone: string | null;
    inferredLocation: string | null;
    confidence: number;

    // Device fingerprint
    deviceChanges: DeviceChange[];
    lastDeviceSignature: string | null;
}

export interface DeviceChange {
    timestamp: Date;
    previousSignature: string | null;
    newSignature: string;
    indicators: string[];
}

export interface MediaMetadata {
    messageId: string;
    from: string;
    type: string;
    timestamp: Date;

    // Extracted metadata (do original)
    fileSize: number;
    filename: string | null;
    mimeType: string;
    duration: number | null;  // para áudio/vídeo
    dimensions: { width: number; height: number } | null;

    // EXIF data if available
    exif: {
        dateTaken: Date | null;
        camera: string | null;
        gps: { lat: number; lon: number } | null;
        software: string | null;
    } | null;
}

export interface ContactTimeline {
    contactId: string;
    events: TimelineEvent[];
    summary: {
        firstContact: Date | null;
        lastContact: Date | null;
        totalMessages: number;
        totalCalls: number;
        totalMediaShared: number;
    };
}

export interface TimelineEvent {
    type: 'message' | 'call' | 'media' | 'presence' | 'ack';
    timestamp: Date;
    description: string;
    metadata?: Record<string, unknown>;
}

// ============================================
// Timezone Mapping (do original)
// ============================================

const TIMEZONE_LOCATION_MAP: Record<string, string> = {
    'America/Sao_Paulo': 'Brasil (Brasília)',
    'America/New_York': 'EUA (Nova York)',
    'America/Los_Angeles': 'EUA (Los Angeles)',
    'Europe/London': 'Reino Unido',
    'Europe/Paris': 'Europa Central',
    'Asia/Tokyo': 'Japão',
    'Asia/Shanghai': 'China',
    'Australia/Sydney': 'Austrália',
};

// ============================================
// Service
// ============================================

@injectable()
export class ForensicsEnhancedService {
    private presencePatterns: Map<string, PresencePattern> = new Map();
    private mediaMetadata: MediaMetadata[] = [];
    private timelines: Map<string, ContactTimeline> = new Map();
    private presenceHistory: Map<string, Array<{ status: string; timestamp: Date }>> = new Map();

    private readonly MAX_HISTORY = 1000;

    constructor(
        private readonly eventBus: EventBus,
        private readonly logger: Logger,
    ) { }

    // ==========================================
    // ENHANCED CALL LOG (do original processEnhancedCall)
    // ==========================================

    processEnhancedCall(
        callData: { id?: string; from?: string; peerJid?: string; type?: string; isVideo?: boolean; isGroup?: boolean; action?: string; duration?: number },
    ): EnhancedCallLog {
        const now = new Date();
        const contactId = callData.from || callData.peerJid || 'unknown';
        const presenceLogs = this.presenceHistory.get(contactId) || [];

        const enhanced: EnhancedCallLog = {
            id: callData.id || `call_${Date.now()}`,
            from: contactId,
            type: (callData.type as 'voice' | 'video') || (callData.isVideo ? 'video' : 'voice'),
            isGroup: callData.isGroup || false,
            timestamp: now,
            action: callData.action || 'received',

            // Enhanced fields
            localTime: now.toLocaleTimeString('pt-BR'),
            dayOfWeek: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][now.getDay()],
            inferredTimezone: this.inferTimezone(presenceLogs),
            inferredLocation: null,
            duration: callData.duration || null,
            protocol: 'VoIP/WebRTC',
            quality: 'N/A',
        };

        // Mapear timezone para localização
        if (enhanced.inferredTimezone) {
            enhanced.inferredLocation = this.mapTimezoneToLocation(enhanced.inferredTimezone);
        }

        // Adicionar ao timeline
        this.addTimelineEvent(contactId, {
            type: 'call',
            timestamp: now,
            description: `${enhanced.type} call - ${enhanced.action}`,
            metadata: { duration: enhanced.duration },
        });

        this.logger.debug(enhanced, `[Forensics] 📞 Enhanced call from ${contactId}`);
        return enhanced;
    }

    // ==========================================
    // TIMEZONE INFERENCE (do original inferTimezone)
    // ==========================================

    /**
     * Infere timezone baseado em padrões de presença
     */
    inferTimezone(presenceLogs: Array<{ status: string; timestamp: Date }>): string | null {
        if (!presenceLogs || presenceLogs.length < 5) return null;

        // Filtrar apenas eventos 'online'
        const onlineHours = presenceLogs
            .filter(l => l.status === 'online' || l.status === 'available')
            .map(l => new Date(l.timestamp).getHours());

        if (onlineHours.length < 3) return null;

        // Calcular média de horários ativos
        const avgHour = onlineHours.reduce((a, b) => a + b, 0) / onlineHours.length;

        // Inferir timezone baseado no horário médio de atividade
        // Assumindo que atividade entre 8-22h é "normal"
        if (avgHour >= 8 && avgHour <= 22) {
            // Provavelmente mesmo fuso ou próximo
            return 'America/Sao_Paulo';
        } else if (avgHour >= 0 && avgHour < 8) {
            // Ativo de madrugada = provavelmente timezone diferente
            const offset = 12 - avgHour;
            if (offset > 9) return 'Asia/Tokyo';
            if (offset > 6) return 'Europe/Paris';
            return 'America/New_York';
        }

        return null;
    }

    mapTimezoneToLocation(timezone: string): string | null {
        return TIMEZONE_LOCATION_MAP[timezone] || null;
    }

    // ==========================================
    // PRESENCE PATTERN ANALYSIS (do original)
    // ==========================================

    /**
     * Registra presença e atualiza padrões
     */
    recordPresence(contactId: string, status: 'online' | 'offline' | 'typing' | 'recording'): PresencePattern {
        const now = new Date();

        // Adicionar ao histórico
        let history = this.presenceHistory.get(contactId) || [];
        history.unshift({ status, timestamp: now });
        if (history.length > this.MAX_HISTORY) history.pop();
        this.presenceHistory.set(contactId, history);

        // Atualizar ou criar padrão
        let pattern = this.presencePatterns.get(contactId) || this.createEmptyPattern(contactId);

        // Calcular horários mais ativos
        const onlineHours = history
            .filter(h => h.status === 'online')
            .map(h => new Date(h.timestamp).getHours());

        const hourCounts = new Array(24).fill(0);
        onlineHours.forEach(h => hourCounts[h]++);

        pattern.mostActiveHours = hourCounts
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(x => x.hour);

        pattern.leastActiveHours = hourCounts
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => a.count - b.count)
            .slice(0, 5)
            .map(x => x.hour);

        // Calcular duração média online/offline
        const durations = this.calculatePresenceDurations(history);
        pattern.avgOnlineDuration = durations.avgOnline;
        pattern.avgOfflineDuration = durations.avgOffline;

        // Inferir timezone
        pattern.inferredTimezone = this.inferTimezone(history);
        if (pattern.inferredTimezone) {
            pattern.inferredLocation = this.mapTimezoneToLocation(pattern.inferredTimezone);
        }

        pattern.confidence = this.calculatePatternConfidence(history.length);

        this.presencePatterns.set(contactId, pattern);

        // Timeline event
        this.addTimelineEvent(contactId, {
            type: 'presence',
            timestamp: now,
            description: `Status: ${status}`,
        });

        return pattern;
    }

    private calculatePresenceDurations(history: Array<{ status: string; timestamp: Date }>): { avgOnline: number; avgOffline: number } {
        const onlineDurations: number[] = [];
        const offlineDurations: number[] = [];

        for (let i = 0; i < history.length - 1; i++) {
            const current = history[i];
            const next = history[i + 1];
            const duration = new Date(current.timestamp).getTime() - new Date(next.timestamp).getTime();

            if (current.status === 'online') {
                onlineDurations.push(duration);
            } else if (current.status === 'offline') {
                offlineDurations.push(duration);
            }
        }

        const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

        return {
            avgOnline: avg(onlineDurations),
            avgOffline: avg(offlineDurations),
        };
    }

    private calculatePatternConfidence(sampleSize: number): number {
        if (sampleSize > 100) return 95;
        if (sampleSize > 50) return 80;
        if (sampleSize > 20) return 60;
        if (sampleSize > 10) return 40;
        return 20;
    }

    getPresencePattern(contactId: string): PresencePattern | null {
        return this.presencePatterns.get(contactId) || null;
    }

    // ==========================================
    // DEVICE FINGERPRINTING (do original)
    // ==========================================

    /**
     * Detecta mudança de dispositivo baseado em padrões
     */
    detectDeviceChange(
        contactId: string,
        indicators: {
            platform?: string;
            pushName?: string;
            profilePic?: string;
            userAgent?: string;
        }
    ): DeviceChange | null {
        const signature = this.generateDeviceSignature(indicators);
        const pattern = this.presencePatterns.get(contactId) || this.createEmptyPattern(contactId);

        if (pattern.lastDeviceSignature && pattern.lastDeviceSignature !== signature) {
            const change: DeviceChange = {
                timestamp: new Date(),
                previousSignature: pattern.lastDeviceSignature,
                newSignature: signature,
                indicators: Object.keys(indicators).filter(k => (indicators as Record<string, unknown>)[k]),
            };

            pattern.deviceChanges.push(change);
            if (pattern.deviceChanges.length > 50) pattern.deviceChanges.shift();

            pattern.lastDeviceSignature = signature;
            this.presencePatterns.set(contactId, pattern);

            this.logger.warn(`[Forensics] 📱 Device change detected for ${contactId}`);
            this.eventBus.emit('forensics:device_change', { contactId, change });

            return change;
        }

        pattern.lastDeviceSignature = signature;
        this.presencePatterns.set(contactId, pattern);
        return null;
    }

    private generateDeviceSignature(indicators: Record<string, unknown>): string {
        // Hash simples dos indicadores
        const data = JSON.stringify(indicators);
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    // ==========================================
    // MEDIA METADATA (do original)
    // ==========================================

    /**
     * Extrai e armazena metadados de mídia
     */
    processMediaMetadata(
        msg: { id: string; from: string; type: string },
        metadata: {
            fileSize: number;
            filename?: string;
            mimeType: string;
            duration?: number;
            width?: number;
            height?: number;
            exif?: {
                dateTaken?: Date;
                camera?: string;
                gps?: { lat: number; lon: number };
                software?: string;
            };
        }
    ): MediaMetadata {
        const record: MediaMetadata = {
            messageId: msg.id,
            from: msg.from,
            type: msg.type,
            timestamp: new Date(),
            fileSize: metadata.fileSize,
            filename: metadata.filename || null,
            mimeType: metadata.mimeType,
            duration: metadata.duration || null,
            dimensions: metadata.width && metadata.height
                ? { width: metadata.width, height: metadata.height }
                : null,
            exif: metadata.exif ? {
                dateTaken: metadata.exif.dateTaken || null,
                camera: metadata.exif.camera || null,
                gps: metadata.exif.gps || null,
                software: metadata.exif.software || null,
            } : null,
        };

        this.mediaMetadata.unshift(record);
        if (this.mediaMetadata.length > this.MAX_HISTORY) this.mediaMetadata.pop();

        // Timeline event
        this.addTimelineEvent(msg.from, {
            type: 'media',
            timestamp: new Date(),
            description: `${msg.type}: ${metadata.filename || 'media'}`,
            metadata: { size: metadata.fileSize, hasExif: !!metadata.exif },
        });

        // Alerta especial se tiver GPS
        if (record.exif?.gps) {
            this.logger.warn(`[Forensics] 📍 Media contains GPS data from ${msg.from}!`);
            this.eventBus.emit('forensics:gps_detected', {
                contactId: msg.from,
                gps: record.exif.gps,
            });
        }

        return record;
    }

    getMediaMetadata(limit = 100): MediaMetadata[] {
        return this.mediaMetadata.slice(0, limit);
    }

    getMediaByContact(contactId: string, limit = 50): MediaMetadata[] {
        return this.mediaMetadata.filter(m => m.from === contactId).slice(0, limit);
    }

    // ==========================================
    // TIMELINE (do original)
    // ==========================================

    private addTimelineEvent(contactId: string, event: TimelineEvent): void {
        let timeline = this.timelines.get(contactId);

        if (!timeline) {
            timeline = {
                contactId,
                events: [],
                summary: {
                    firstContact: null,
                    lastContact: null,
                    totalMessages: 0,
                    totalCalls: 0,
                    totalMediaShared: 0,
                },
            };
        }

        timeline.events.unshift(event);
        if (timeline.events.length > this.MAX_HISTORY) timeline.events.pop();

        // Update summary
        timeline.summary.lastContact = event.timestamp;
        if (!timeline.summary.firstContact) {
            timeline.summary.firstContact = event.timestamp;
        }

        if (event.type === 'message') timeline.summary.totalMessages++;
        if (event.type === 'call') timeline.summary.totalCalls++;
        if (event.type === 'media') timeline.summary.totalMediaShared++;

        this.timelines.set(contactId, timeline);
    }

    getContactTimeline(contactId: string): ContactTimeline | null {
        return this.timelines.get(contactId) || null;
    }

    // ==========================================
    // Helpers
    // ==========================================

    private createEmptyPattern(contactId: string): PresencePattern {
        return {
            contactId,
            mostActiveHours: [],
            leastActiveHours: [],
            avgOnlineDuration: 0,
            avgOfflineDuration: 0,
            inferredTimezone: null,
            inferredLocation: null,
            confidence: 0,
            deviceChanges: [],
            lastDeviceSignature: null,
        };
    }

    // ==========================================
    // Status
    // ==========================================

    getStatus(): {
        contactsAnalyzed: number;
        mediaRecords: number;
        deviceChangesDetected: number;
        gpsLocationsFound: number;
    } {
        let deviceChanges = 0;
        this.presencePatterns.forEach(p => deviceChanges += p.deviceChanges.length);

        const gpsLocations = this.mediaMetadata.filter(m => m.exif?.gps).length;

        return {
            contactsAnalyzed: this.presencePatterns.size,
            mediaRecords: this.mediaMetadata.length,
            deviceChangesDetected: deviceChanges,
            gpsLocationsFound: gpsLocations,
        };
    }
}
