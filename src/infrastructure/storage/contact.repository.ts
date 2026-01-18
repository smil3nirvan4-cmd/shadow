/**
 * JARVIS ULTIMATE - SQLite Contact Repository
 * 
 * Implements ContactRepository interface with SQLite storage.
 */

import { injectable, inject } from 'tsyringe';
import Database from 'better-sqlite3';
import { Contact } from '../../domain/contact/contact.entity.js';
import { ContactRepository, FindOptions } from '../../domain/shared/repository.interface.js';
import { DatabaseManager } from './database.js';

@injectable()
export class SQLiteContactRepository implements ContactRepository {
    private db: Database.Database;

    constructor(@inject('DatabaseManager') dbManager: DatabaseManager) {
        this.db = dbManager.getDatabase();
    }

    async findById(id: string): Promise<Contact | null> {
        const row = this.db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as ContactRow | undefined;
        return row ? this.rowToEntity(row) : null;
    }

    async findAll(options?: FindOptions): Promise<Contact[]> {
        const limit = options?.limit || 100;
        const offset = options?.offset || 0;

        const rows = this.db.prepare(
            'SELECT * FROM contacts ORDER BY last_interaction DESC LIMIT ? OFFSET ?'
        ).all(limit, offset) as ContactRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    async save(entity: Contact): Promise<void> {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO contacts 
            (id, name, push_name, phone_number, profile_pic_url, status, 
             is_blocked, is_business, is_group, first_interaction, last_interaction, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        const data = entity.toJSON();
        stmt.run(
            entity.id,
            data.name || null,
            data.pushName || null,
            entity.getPhoneNumber() || null,
            data.profilePicUrl || null,
            data.about || null, // 'about' is the status field in Contact
            data.isBlocked ? 1 : 0,
            data.isBusiness ? 1 : 0,
            data.isGroup ? 1 : 0,
            data.firstInteraction?.toISOString() || null,
            data.lastInteraction?.toISOString() || null
        );
    }

    async delete(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
        return result.changes > 0;
    }

    async exists(id: string): Promise<boolean> {
        const row = this.db.prepare('SELECT 1 FROM contacts WHERE id = ? LIMIT 1').get(id);
        return !!row;
    }

    async count(filter?: Record<string, unknown>): Promise<number> {
        let sql = 'SELECT COUNT(*) as count FROM contacts';
        const params: unknown[] = [];

        if (filter?.isBlocked !== undefined) {
            sql += ' WHERE is_blocked = ?';
            params.push(filter.isBlocked ? 1 : 0);
        }

        const row = this.db.prepare(sql).get(...params) as { count: number };
        return row.count;
    }

    async findByPhoneNumber(phone: string): Promise<Contact | null> {
        const row = this.db.prepare(
            'SELECT * FROM contacts WHERE phone_number = ? OR id LIKE ?'
        ).get(phone, `${phone}@%`) as ContactRow | undefined;

        return row ? this.rowToEntity(row) : null;
    }

    async findActive(since: Date): Promise<Contact[]> {
        const rows = this.db.prepare(
            'SELECT * FROM contacts WHERE last_interaction >= ? ORDER BY last_interaction DESC'
        ).all(since.toISOString()) as ContactRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    async updateLastInteraction(contactId: string, date: Date): Promise<void> {
        this.db.prepare(
            'UPDATE contacts SET last_interaction = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(date.toISOString(), contactId);
    }

    async search(query: string): Promise<Contact[]> {
        const rows = this.db.prepare(
            'SELECT * FROM contacts WHERE name LIKE ? OR push_name LIKE ? OR phone_number LIKE ? LIMIT 50'
        ).all(`%${query}%`, `%${query}%`, `%${query}%`) as ContactRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    async findBlocked(): Promise<Contact[]> {
        const rows = this.db.prepare(
            'SELECT * FROM contacts WHERE is_blocked = 1'
        ).all() as ContactRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    async getAll(): Promise<Contact[]> {
        const rows = this.db.prepare(
            'SELECT * FROM contacts ORDER BY name ASC'
        ).all() as ContactRow[];

        return rows.map(row => this.rowToEntity(row));
    }

    // ==========================================
    // Helpers
    // ==========================================

    private rowToEntity(row: ContactRow): Contact {
        const result = Contact.create({
            id: row.id,
            name: row.name || undefined,
            pushName: row.push_name || undefined,
            phoneNumber: row.phone_number || undefined,
            profilePicUrl: row.profile_pic_url || undefined,
            status: row.status || undefined,
            isBlocked: row.is_blocked === 1,
            isBusiness: row.is_business === 1,
            isGroup: row.is_group === 1,
            firstInteraction: row.first_interaction ? new Date(row.first_interaction) : undefined,
            lastInteraction: row.last_interaction ? new Date(row.last_interaction) : undefined,
        });

        if (result.success) {
            return result.data;
        }

        throw new Error(`Failed to parse contact ${row.id}`);
    }
}

interface ContactRow {
    id: string;
    name: string | null;
    push_name: string | null;
    phone_number: string | null;
    profile_pic_url: string | null;
    status: string | null;
    is_blocked: number;
    is_business: number;
    is_group: number;
    first_interaction: string | null;
    last_interaction: string | null;
}
