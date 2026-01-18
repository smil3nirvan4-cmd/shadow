/**
 * JARVIS ULTIMATE - SQLite Message Repository
 * 
 * Implements MessageRepository interface with SQLite storage.
 */

import { injectable, inject } from 'tsyringe';
import Database from 'better-sqlite3';
import { Message, AckLevel } from '../../domain/message/message.entity.js';
import {
    MessageRepository,
    MessageStats,
    FindOptions
} from '../../domain/shared/repository.interface.js';
import { DatabaseManager } from './database.js';

@injectable()
export class SQLiteMessageRepository implements MessageRepository {
    private db: Database.Database;

    constructor(@inject('DatabaseManager') dbManager: DatabaseManager) {
        this.db = dbManager.getDatabase();
    }

    async findById(id: string): Promise<Message | null> {
        const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined;
        return row ? this.rowToEntity(row) : null;
    }

    async findAll(options?: FindOptions): Promise<Message[]> {
        const limit = options?.limit || 100;
        const offset = options?.offset || 0;
        const orderBy = options?.orderBy || 'timestamp';
        const order = options?.order || 'desc';

        const rows = this.db.prepare(
            `SELECT * FROM messages ORDER BY ${orderBy} ${order} LIMIT ? OFFSET ?`
        ).all(limit, offset) as MessageRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    async save(entity: Message): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO messages 
            (id, chat_id, sender, body, type, from_me, has_media, media_type, 
             media_url, ack, timestamp, is_deleted, is_forwarded, reply_to)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const json = entity.toJSON();
        stmt.run(
            entity.id,
            entity.chatId,
            entity.sender,
            entity.body,
            entity.type,
            entity.fromMe ? 1 : 0,
            entity.hasMedia() ? 1 : 0,
            json.mimetype || null,
            entity.mediaUrl || null,
            entity.ack,
            entity.timestamp.getTime(),
            0, // isDeleted - not tracked in entity, would be in metadata
            entity.isForwarded ? 1 : 0,
            entity.quotedMessageId || null
        );
    }

    async delete(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM messages WHERE id = ?').run(id);
        return result.changes > 0;
    }

    async exists(id: string): Promise<boolean> {
        const row = this.db.prepare('SELECT 1 FROM messages WHERE id = ? LIMIT 1').get(id);
        return !!row;
    }

    async count(filter?: Record<string, unknown>): Promise<number> {
        let sql = 'SELECT COUNT(*) as count FROM messages';
        const params: unknown[] = [];

        if (filter?.chatId) {
            sql += ' WHERE chat_id = ?';
            params.push(filter.chatId);
        }

        const row = this.db.prepare(sql).get(...params) as { count: number };
        return row.count;
    }

    async findByChatId(chatId: string, options?: FindOptions): Promise<Message[]> {
        const limit = options?.limit || 100;
        const offset = options?.offset || 0;

        const rows = this.db.prepare(
            'SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        ).all(chatId, limit, offset) as MessageRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    async findByDateRange(start: Date, end: Date): Promise<Message[]> {
        const rows = this.db.prepare(
            'SELECT * FROM messages WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC'
        ).all(start.getTime(), end.getTime()) as MessageRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    async findRecent(chatId: string, limit = 10): Promise<Message[]> {
        const rows = this.db.prepare(
            'SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT ?'
        ).all(chatId, limit) as MessageRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    async updateAck(messageId: string, ack: AckLevel): Promise<void> {
        this.db.prepare('UPDATE messages SET ack = ? WHERE id = ?').run(ack, messageId);
    }

    async findRevoked(): Promise<Message[]> {
        const rows = this.db.prepare(
            'SELECT * FROM messages WHERE is_deleted = 1 ORDER BY timestamp DESC'
        ).all() as MessageRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    async getStatsByChat(chatId: string): Promise<MessageStats> {
        const stats = this.db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN from_me = 0 THEN 1 ELSE 0 END) as received,
                SUM(CASE WHEN from_me = 1 THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN has_media = 1 THEN 1 ELSE 0 END) as media,
                SUM(CASE WHEN body LIKE '!%' OR body LIKE '/%' THEN 1 ELSE 0 END) as commands
            FROM messages WHERE chat_id = ?
        `).get(chatId) as { total: number; received: number; sent: number; media: number; commands: number };

        return {
            total: stats.total || 0,
            received: stats.received || 0,
            sent: stats.sent || 0,
            media: stats.media || 0,
            commands: stats.commands || 0,
        };
    }

    async search(query: string, chatId?: string): Promise<Message[]> {
        let sql = 'SELECT * FROM messages WHERE body LIKE ?';
        const params: unknown[] = [`%${query}%`];

        if (chatId) {
            sql += ' AND chat_id = ?';
            params.push(chatId);
        }

        sql += ' ORDER BY timestamp DESC LIMIT 100';

        const rows = this.db.prepare(sql).all(...params) as MessageRow[];
        return rows.map(row => this.rowToEntity(row));
    }

    // ==========================================
    // Helpers
    // ==========================================

    private rowToEntity(row: MessageRow): Message {
        const result = Message.fromRaw({
            id: { _serialized: row.id },
            from: row.sender,
            to: row.chat_id,
            body: row.body,
            type: row.type,
            fromMe: row.from_me === 1,
            hasMedia: row.has_media === 1,
            timestamp: row.timestamp,
            ack: row.ack,
        });

        if (result.success) {
            return result.data;
        }

        // Fallback - create minimal message
        throw new Error(`Failed to parse message ${row.id}`);
    }
}

interface MessageRow {
    id: string;
    chat_id: string;
    sender: string;
    body: string;
    type: string;
    from_me: number;
    has_media: number;
    media_type: string | null;
    media_url: string | null;
    ack: number;
    timestamp: number;
    is_deleted: number;
    is_forwarded: number;
    reply_to: string | null;
}
