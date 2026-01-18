/**
 * JARVIS ULTIMATE - WhatsApp Protobuf Parser
 * 
 * Parses WebMessageInfo, Message, and ContextInfo structures.
 * Critical for forensic analysis of message manipulation.
 */

// ============================================
// Protobuf Tag Definitions
// ============================================

export const MESSAGE_TAGS = {
    // Message types (from WebMessageInfo.message)
    CONVERSATION: 1,
    SENDER_KEY: 2,
    IMAGE: 3,
    CONTACT: 4,
    LOCATION: 5,
    EXTENDED_TEXT: 6,
    DOCUMENT: 7,
    AUDIO: 8,
    VIDEO: 9,
    CALL: 10,
    CHAT: 11,
    PROTOCOL: 12,
    CONTACTS_ARRAY: 13,
    HS_IV: 14,
    HS_PAYLOAD: 15,
    TEMPLATE: 16,
    STICKER: 26,
    GROUP_INVITE: 28,
    TEMPLATE_BUTTON_REPLY: 29,
    PRODUCT: 30,
    DEVICE_SENT: 31,
    LIVE_LOCATION: 35,
    REACTION: 36,
    VIEW_ONCE: 37,
    POLL_CREATION: 38,
    POLL_UPDATE: 39,
    VIEW_ONCE_V2: 55,
} as const;

export const CONTEXT_INFO_TAGS = {
    STANZA_ID: 1,
    PARTICIPANT: 2,
    QUOTED_MESSAGE: 3,
    REMOTE_JID: 4,
    MENTIONED_JID: 15,
    CONVERSION_SOURCE: 18,
    CONVERSION_DATA: 19,
    IS_FORWARDED: 22,
    FORWARDING_SCORE: 23,
    IS_FORWARDED_REMINDER: 24,
    QUOTED_AD: 25,
    PLACEHOLDER_KEY: 26,
} as const;

export const ACK_STATUS = {
    0: 'ERROR',
    1: 'PENDING',
    2: 'SERVER_ACK',
    3: 'DELIVERY_ACK',
    4: 'READ',
    5: 'PLAYED',
} as const;

// ============================================
// Types
// ============================================

export interface MessageKey {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
}

export interface ContextInfo {
    stanzaId?: string;
    participant?: string;
    quotedMessage?: ParsedMessage;
    remoteJid?: string;
    mentionedJid?: string[];
    isForwarded?: boolean;
    forwardingScore?: number;
}

export interface ParsedMessage {
    type: string;
    content?: string;
    caption?: string;
    url?: string;
    mimetype?: string;
    fileSha256?: string;
    fileLength?: number;
    mediaKey?: Uint8Array;
    contextInfo?: ContextInfo;
    viewOnce?: boolean;
    // Extended fields
    latitude?: number;
    longitude?: number;
    thumbnailBase64?: string;
}

export interface WebMessageInfo {
    key: MessageKey;
    message?: ParsedMessage;
    messageTimestamp?: number;
    status?: string;
    participant?: string;
    broadcast?: boolean;
    pushName?: string;
    starred?: boolean;
    ephemeralStartTimestamp?: number;
    ephemeralDuration?: number;
}

export interface ForensicAnalysis {
    messageId: string;
    timestamp: Date;
    anomalies: ForensicAnomaly[];
    riskScore: number;
    isManipulated: boolean;
}

export interface ForensicAnomaly {
    type: 'FAKE_QUOTE' | 'GHOST_MENTION' | 'VIEWONCE_BYPASS' | 'REACTION_INJECTION' | 'TIMESTAMP_MISMATCH';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    evidence: Record<string, unknown>;
}

// ============================================
// Protobuf Parser Class
// ============================================

export class ProtobufParser {
    private data: Uint8Array;
    private offset: number = 0;

    constructor(data: Uint8Array) {
        this.data = data;
    }

    // ==========================================
    // Main Parse Method
    // ==========================================

    parseWebMessageInfo(): WebMessageInfo | null {
        try {
            const fields = this.parseMessage();

            return {
                key: this.parseMessageKey(fields[1] as Uint8Array),
                message: fields[2] ? this.parseMessageContent(fields[2] as Uint8Array) : undefined,
                messageTimestamp: fields[3] as number,
                status: ACK_STATUS[(fields[4] as number) as keyof typeof ACK_STATUS] || 'UNKNOWN',
                participant: fields[5] as string,
                broadcast: fields[10] as boolean,
                pushName: fields[19] as string,
                starred: fields[23] as boolean,
                ephemeralStartTimestamp: fields[32] as number,
                ephemeralDuration: fields[33] as number,
            };
        } catch (error) {
            console.error('Failed to parse WebMessageInfo:', error);
            return null;
        }
    }

    // ==========================================
    // Field Parsing
    // ==========================================

    private parseMessage(): Record<number, unknown> {
        const fields: Record<number, unknown> = {};

        while (this.offset < this.data.length) {
            const tag = this.readVarint();
            const fieldNumber = tag >> 3;
            const wireType = tag & 0x7;

            switch (wireType) {
                case 0: // Varint
                    fields[fieldNumber] = this.readVarint();
                    break;
                case 1: // 64-bit
                    fields[fieldNumber] = this.readFixed64();
                    break;
                case 2: // Length-delimited
                    const length = this.readVarint();
                    fields[fieldNumber] = this.readBytes(length);
                    break;
                case 5: // 32-bit
                    fields[fieldNumber] = this.readFixed32();
                    break;
                default:
                    throw new Error(`Unknown wire type: ${wireType}`);
            }
        }

        return fields;
    }

    private parseMessageKey(data: Uint8Array): MessageKey {
        const parser = new ProtobufParser(data);
        const fields = parser.parseMessage();

        return {
            remoteJid: this.decodeString(fields[1] as Uint8Array) || '',
            fromMe: Boolean(fields[2]),
            id: this.decodeString(fields[3] as Uint8Array) || '',
            participant: fields[4] ? this.decodeString(fields[4] as Uint8Array) : undefined,
        };
    }

    private parseMessageContent(data: Uint8Array): ParsedMessage {
        const parser = new ProtobufParser(data);
        const fields = parser.parseMessage();

        // Determine message type from which field is present
        let type = 'unknown';
        let content: string | undefined;
        let contextInfo: ContextInfo | undefined;
        let viewOnce = false;

        if (fields[MESSAGE_TAGS.CONVERSATION]) {
            type = 'conversation';
            content = this.decodeString(fields[MESSAGE_TAGS.CONVERSATION] as Uint8Array);
        } else if (fields[MESSAGE_TAGS.EXTENDED_TEXT]) {
            type = 'extendedText';
            const extData = new ProtobufParser(fields[MESSAGE_TAGS.EXTENDED_TEXT] as Uint8Array).parseMessage();
            content = this.decodeString(extData[1] as Uint8Array);
            if (extData[17]) {
                contextInfo = this.parseContextInfo(extData[17] as Uint8Array);
            }
        } else if (fields[MESSAGE_TAGS.IMAGE]) {
            type = 'image';
            const imgData = new ProtobufParser(fields[MESSAGE_TAGS.IMAGE] as Uint8Array).parseMessage();
            content = this.decodeString(imgData[4] as Uint8Array); // caption
            if (imgData[17]) {
                contextInfo = this.parseContextInfo(imgData[17] as Uint8Array);
            }
        } else if (fields[MESSAGE_TAGS.VIDEO]) {
            type = 'video';
        } else if (fields[MESSAGE_TAGS.AUDIO]) {
            type = 'audio';
        } else if (fields[MESSAGE_TAGS.DOCUMENT]) {
            type = 'document';
        } else if (fields[MESSAGE_TAGS.STICKER]) {
            type = 'sticker';
        } else if (fields[MESSAGE_TAGS.REACTION]) {
            type = 'reaction';
            const reactionData = new ProtobufParser(fields[MESSAGE_TAGS.REACTION] as Uint8Array).parseMessage();
            content = this.decodeString(reactionData[1] as Uint8Array); // emoji
        } else if (fields[MESSAGE_TAGS.VIEW_ONCE] || fields[MESSAGE_TAGS.VIEW_ONCE_V2]) {
            type = 'viewOnce';
            viewOnce = true;
            // Parse inner message
            const voData = new ProtobufParser(
                (fields[MESSAGE_TAGS.VIEW_ONCE] || fields[MESSAGE_TAGS.VIEW_ONCE_V2]) as Uint8Array
            ).parseMessage();
            if (voData[MESSAGE_TAGS.IMAGE]) {
                type = 'viewOnceImage';
            } else if (voData[MESSAGE_TAGS.VIDEO]) {
                type = 'viewOnceVideo';
            }
        } else if (fields[MESSAGE_TAGS.PROTOCOL]) {
            type = 'protocol';
        } else if (fields[MESSAGE_TAGS.CALL]) {
            type = 'call';
        }

        return {
            type,
            content,
            contextInfo,
            viewOnce,
        };
    }

    private parseContextInfo(data: Uint8Array): ContextInfo {
        const parser = new ProtobufParser(data);
        const fields = parser.parseMessage();

        const contextInfo: ContextInfo = {};

        if (fields[CONTEXT_INFO_TAGS.STANZA_ID]) {
            contextInfo.stanzaId = this.decodeString(fields[CONTEXT_INFO_TAGS.STANZA_ID] as Uint8Array);
        }
        if (fields[CONTEXT_INFO_TAGS.PARTICIPANT]) {
            contextInfo.participant = this.decodeString(fields[CONTEXT_INFO_TAGS.PARTICIPANT] as Uint8Array);
        }
        if (fields[CONTEXT_INFO_TAGS.QUOTED_MESSAGE]) {
            contextInfo.quotedMessage = this.parseMessageContent(fields[CONTEXT_INFO_TAGS.QUOTED_MESSAGE] as Uint8Array);
        }
        if (fields[CONTEXT_INFO_TAGS.REMOTE_JID]) {
            contextInfo.remoteJid = this.decodeString(fields[CONTEXT_INFO_TAGS.REMOTE_JID] as Uint8Array);
        }
        if (fields[CONTEXT_INFO_TAGS.IS_FORWARDED]) {
            contextInfo.isForwarded = Boolean(fields[CONTEXT_INFO_TAGS.IS_FORWARDED]);
        }
        if (fields[CONTEXT_INFO_TAGS.FORWARDING_SCORE]) {
            contextInfo.forwardingScore = fields[CONTEXT_INFO_TAGS.FORWARDING_SCORE] as number;
        }

        // Handle mentioned JIDs (repeated field)
        if (fields[CONTEXT_INFO_TAGS.MENTIONED_JID]) {
            const mentioned = fields[CONTEXT_INFO_TAGS.MENTIONED_JID];
            if (Array.isArray(mentioned)) {
                contextInfo.mentionedJid = mentioned.map(m => this.decodeString(m as Uint8Array));
            } else {
                contextInfo.mentionedJid = [this.decodeString(mentioned as Uint8Array)];
            }
        }

        return contextInfo;
    }

    // ==========================================
    // Primitive Reading
    // ==========================================

    private readVarint(): number {
        let result = 0;
        let shift = 0;
        while (true) {
            const byte = this.data[this.offset++];
            result |= (byte & 0x7F) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
        }
        return result >>> 0;
    }

    private readFixed32(): number {
        const value =
            this.data[this.offset] |
            (this.data[this.offset + 1] << 8) |
            (this.data[this.offset + 2] << 16) |
            (this.data[this.offset + 3] << 24);
        this.offset += 4;
        return value >>> 0;
    }

    private readFixed64(): bigint {
        const low = this.readFixed32();
        const high = this.readFixed32();
        return BigInt(high) << 32n | BigInt(low);
    }

    private readBytes(length: number): Uint8Array {
        const bytes = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return bytes;
    }

    private decodeString(bytes: Uint8Array): string {
        if (!bytes) return '';
        return new TextDecoder().decode(bytes);
    }
}

// ============================================
// Forensic Analyzer
// ============================================

export class ForensicAnalyzer {
    /**
     * Analyze a message for manipulation indicators
     */
    static analyze(msg: WebMessageInfo): ForensicAnalysis {
        const anomalies: ForensicAnomaly[] = [];

        // Check for fake quotes
        const fakeQuoteCheck = this.detectFakeQuote(msg);
        if (fakeQuoteCheck) anomalies.push(fakeQuoteCheck);

        // Check for ghost mentions
        const ghostMentionCheck = this.detectGhostMentions(msg);
        if (ghostMentionCheck) anomalies.push(ghostMentionCheck);

        // Check for ViewOnce bypass indicators
        const viewOnceCheck = this.detectViewOnceAnomaly(msg);
        if (viewOnceCheck) anomalies.push(viewOnceCheck);

        // Calculate risk score
        const riskScore = this.calculateRiskScore(anomalies);

        return {
            messageId: msg.key.id,
            timestamp: new Date(msg.messageTimestamp || Date.now()),
            anomalies,
            riskScore,
            isManipulated: anomalies.some(a => a.severity === 'HIGH' || a.severity === 'CRITICAL'),
        };
    }

    private static detectFakeQuote(msg: WebMessageInfo): ForensicAnomaly | null {
        const contextInfo = msg.message?.contextInfo;
        if (!contextInfo?.quotedMessage) return null;

        // Indicators of fake quote:
        // 1. stanzaId doesn't match expected format
        // 2. participant doesn't match message sender pattern
        // 3. quotedMessage content seems fabricated

        const stanzaId = contextInfo.stanzaId || '';
        const isValidStanzaFormat = /^[A-Za-z0-9]{24,}$/.test(stanzaId) || /^[0-9A-F]{32}$/i.test(stanzaId);

        if (!isValidStanzaFormat && stanzaId.length > 0) {
            return {
                type: 'FAKE_QUOTE',
                severity: 'HIGH',
                description: 'Quote stanza ID has invalid format, possible message fabrication',
                evidence: {
                    stanzaId,
                    participant: contextInfo.participant,
                    quotedContent: contextInfo.quotedMessage.content,
                },
            };
        }

        return null;
    }

    private static detectGhostMentions(msg: WebMessageInfo): ForensicAnomaly | null {
        const content = msg.message?.content || '';
        const mentionedJids = msg.message?.contextInfo?.mentionedJid || [];

        if (mentionedJids.length === 0) return null;

        // Check if mentions appear in the text
        const textHasMentionIndicator = content.includes('@');

        if (!textHasMentionIndicator && mentionedJids.length > 0) {
            return {
                type: 'GHOST_MENTION',
                severity: 'MEDIUM',
                description: 'Message has hidden mentions not visible in text',
                evidence: {
                    mentionedJids,
                    messageContent: content.substring(0, 100),
                    mentionCount: mentionedJids.length,
                },
            };
        }

        return null;
    }

    private static detectViewOnceAnomaly(msg: WebMessageInfo): ForensicAnomaly | null {
        if (!msg.message?.viewOnce) return null;

        // If ViewOnce message was accessed multiple times or has unusual metadata
        return {
            type: 'VIEWONCE_BYPASS',
            severity: 'LOW',
            description: 'ViewOnce media detected - can be bypassed by custom clients',
            evidence: {
                messageType: msg.message.type,
                hasMediaKey: !!msg.message.mediaKey,
            },
        };
    }

    private static calculateRiskScore(anomalies: ForensicAnomaly[]): number {
        const weights = {
            LOW: 10,
            MEDIUM: 30,
            HIGH: 50,
            CRITICAL: 100,
        };

        const total = anomalies.reduce((sum, a) => sum + weights[a.severity], 0);
        return Math.min(100, total);
    }
}
