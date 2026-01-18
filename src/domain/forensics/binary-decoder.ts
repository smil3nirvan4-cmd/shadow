/**
 * JARVIS ULTIMATE - WhatsApp Binary Tag Decoder
 * 
 * Decodes WhatsApp's binary XML (WABinary) format used in WebSocket communication.
 * Based on reverse engineering of the WhatsApp Web protocol.
 */

// ============================================
// Binary Tag Dictionary
// ============================================

export const SINGLE_BYTE_TOKENS: Record<number, string> = {
    1: 'xmlstreamstart',
    2: 'xmlstreamend',
    3: 'list_empty',
    // Message tags
    5: 'message',
    6: 'ack',
    7: 'receipt',
    8: 'call',
    9: 'presence',
    10: 'iq',
    11: 'notification',
    12: 'failure',
    13: 'success',
    14: 'action',
    // Attributes
    20: 'id',
    21: 'from',
    22: 'to',
    23: 'participant',
    24: 'type',
    25: 'notify',
    26: 'class',
    27: 'enc',
    28: 'media',
    // Call-specific
    40: 'offer',
    41: 'answer',
    42: 'terminate',
    43: 'reject',
    44: 'audio',
    45: 'video',
    // Status tokens
    60: 'available',
    61: 'unavailable',
    62: 'composing',
    63: 'paused',
    64: 'recording',
    // Misc
    80: 'relay',
    81: 'props',
    82: 'dirty',
    83: 'category',
    84: 'duration',
    85: 'reason',
};

// JID suffixes
export const JID_SUFFIXES: Record<number, string> = {
    0: '@s.whatsapp.net',     // User
    1: '@g.us',               // Group
    2: '@broadcast',          // Broadcast list
    3: '@c.us',               // Legacy user
    4: '@newsletter',         // Newsletter/Channel
    5: '@lid',                // Linked device
};

// ============================================
// Types
// ============================================

export interface BinaryNode {
    tag: string;
    attrs: Record<string, string>;
    content?: BinaryNode[] | Uint8Array | string;
}

export interface DecodedMessage {
    raw: BinaryNode;
    messageType: string;
    from?: string;
    to?: string;
    id?: string;
    timestamp?: number;
    participant?: string;
    content?: unknown;
}

// ============================================
// Binary Decoder Class
// ============================================

export class WABinaryDecoder {
    private buffer: Uint8Array;
    private index: number = 0;

    constructor(data: Uint8Array) {
        this.buffer = data;
    }

    // ==========================================
    // Main Decode Method
    // ==========================================

    decode(): BinaryNode | null {
        try {
            return this.readNode();
        } catch (error) {
            console.error('Binary decode error:', error);
            return null;
        }
    }

    // ==========================================
    // Node Reading
    // ==========================================

    private readNode(): BinaryNode | null {
        const listSize = this.readListSize();
        if (listSize === 0) return null;

        const descriptionByte = this.readByte();
        if (descriptionByte === 1) {
            // Stream start
            return this.readNode();
        }
        if (descriptionByte === 2) {
            // Stream end
            return null;
        }

        const tag = this.readString(descriptionByte);
        const attrs = this.readAttributes((listSize - 1) >> 1);

        if (listSize % 2 === 0) {
            return { tag, attrs };
        }

        const contentDescriptor = this.peekByte();
        let content: BinaryNode[] | Uint8Array | string;

        if (this.isListTag(contentDescriptor)) {
            content = this.readList();
        } else if (contentDescriptor === 0xFC) {
            // Binary data
            this.readByte();
            const length = this.readInt20();
            content = this.readBytes(length);
        } else if (contentDescriptor === 0xFD) {
            // Long binary
            this.readByte();
            const length = this.readInt32();
            content = this.readBytes(length);
        } else {
            content = this.readString(this.readByte());
        }

        return { tag, attrs, content };
    }

    // ==========================================
    // Primitive Reading
    // ==========================================

    private readByte(): number {
        return this.buffer[this.index++];
    }

    private peekByte(): number {
        return this.buffer[this.index];
    }

    private readBytes(length: number): Uint8Array {
        const bytes = this.buffer.slice(this.index, this.index + length);
        this.index += length;
        return bytes;
    }

    private readInt16(): number {
        const val = (this.buffer[this.index] << 8) | this.buffer[this.index + 1];
        this.index += 2;
        return val;
    }

    private readInt20(): number {
        const b0 = this.buffer[this.index++];
        const b1 = this.buffer[this.index++];
        const b2 = this.buffer[this.index++];
        return ((b0 & 0x0F) << 16) | (b1 << 8) | b2;
    }

    private readInt32(): number {
        const val = (this.buffer[this.index] << 24) |
            (this.buffer[this.index + 1] << 16) |
            (this.buffer[this.index + 2] << 8) |
            this.buffer[this.index + 3];
        this.index += 4;
        return val >>> 0;
    }

    // ==========================================
    // String Reading
    // ==========================================

    private readString(tag: number): string {
        if (tag >= 1 && tag < 0x80 && SINGLE_BYTE_TOKENS[tag]) {
            return SINGLE_BYTE_TOKENS[tag];
        }

        switch (tag) {
            case 0x00:
                return '';
            case 0xFC: {
                const len = this.readByte();
                return this.decodeString(this.readBytes(len));
            }
            case 0xFD: {
                const len = this.readInt20();
                return this.decodeString(this.readBytes(len));
            }
            case 0xFE: {
                const len = this.readInt32();
                return this.decodeString(this.readBytes(len));
            }
            case 0xFA:
                return this.readJidPair();
            case 0xFB:
                return this.readHexString() + JID_SUFFIXES[this.readByte()] || '';
            default:
                return `token_${tag}`;
        }
    }

    private readJidPair(): string {
        const user = this.readString(this.readByte());
        const server = this.readString(this.readByte());
        return user ? `${user}@${server}` : server;
    }

    private readHexString(): string {
        const b0 = this.readByte();
        const len = b0 & 0x7F;
        const bytes = this.readBytes(len);
        let hex = '';
        for (const byte of bytes) {
            hex += byte.toString(16).padStart(2, '0').toUpperCase();
        }
        if (b0 & 0x80) {
            hex = hex.slice(0, -1); // Remove trailing nibble
        }
        return hex;
    }

    private decodeString(bytes: Uint8Array): string {
        return new TextDecoder().decode(bytes);
    }

    // ==========================================
    // List Reading
    // ==========================================

    private isListTag(tag: number): boolean {
        return tag === 0x00 || tag === 0xF8 || tag === 0xF9;
    }

    private readListSize(): number {
        const tag = this.readByte();
        if (tag === 0x00) return 0;
        if (tag === 0xF8) return this.readByte();
        if (tag === 0xF9) return this.readInt16();
        throw new Error(`Invalid list tag: ${tag}`);
    }

    private readList(): BinaryNode[] {
        const size = this.readListSize();
        const list: BinaryNode[] = [];
        for (let i = 0; i < size; i++) {
            const node = this.readNode();
            if (node) list.push(node);
        }
        return list;
    }

    // ==========================================
    // Attribute Reading
    // ==========================================

    private readAttributes(count: number): Record<string, string> {
        const attrs: Record<string, string> = {};
        for (let i = 0; i < count; i++) {
            const key = this.readString(this.readByte());
            const value = this.readString(this.readByte());
            attrs[key] = value;
        }
        return attrs;
    }

    // ==========================================
    // Static Helpers
    // ==========================================

    static decodeFrame(data: Uint8Array): DecodedMessage | null {
        const decoder = new WABinaryDecoder(data);
        const node = decoder.decode();

        if (!node) return null;

        return {
            raw: node,
            messageType: node.tag,
            from: node.attrs['from'],
            to: node.attrs['to'],
            id: node.attrs['id'],
            participant: node.attrs['participant'],
            content: node.content,
        };
    }

    static nodeToJSON(node: BinaryNode): unknown {
        const result: Record<string, unknown> = {
            tag: node.tag,
            attrs: node.attrs,
        };

        if (node.content) {
            if (Array.isArray(node.content)) {
                result.children = node.content.map(child =>
                    WABinaryDecoder.nodeToJSON(child)
                );
            } else if (node.content instanceof Uint8Array) {
                result.data = `[Binary: ${node.content.length} bytes]`;
                result.hex = Array.from(node.content.slice(0, 50))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join(' ');
            } else {
                result.text = node.content;
            }
        }

        return result;
    }
}
