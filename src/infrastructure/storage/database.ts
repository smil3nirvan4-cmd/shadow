/**
 * JARVIS ULTIMATE - SQLite Database Connection
 * 
 * Database initialization and connection management.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Config } from '../../core/config.js';
import { Logger } from '../../core/logger.js';

// ============================================
// Database Manager
// ============================================

export class DatabaseManager {
    private db: Database.Database | null = null;

    constructor(
        private config: Config,
        private logger: Logger,
    ) { }

    /**
     * Initialize database with tables
     */
    initialize(): Database.Database {
        if (this.db) return this.db;

        const storagePath = this.config.storage.path;
        const filename = this.config.storage.sqlite?.filename || 'brain.db';

        // Ensure storage directory exists
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }

        const dbPath = path.join(storagePath, filename);

        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        this.createTables();
        this.logger.info({ dbPath }, 'SQLite database initialized');

        return this.db;
    }

    /**
     * Get database instance
     */
    getDatabase(): Database.Database {
        if (!this.db) {
            return this.initialize();
        }
        return this.db;
    }

    /**
     * Close database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.logger.info('Database connection closed');
        }
    }

    /**
     * Create all tables
     */
    private createTables(): void {
        this.db!.exec(`
            -- Messages table
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                sender TEXT NOT NULL,
                body TEXT NOT NULL,
                type TEXT DEFAULT 'chat',
                from_me INTEGER DEFAULT 0,
                has_media INTEGER DEFAULT 0,
                media_type TEXT,
                media_url TEXT,
                ack INTEGER DEFAULT 0,
                timestamp INTEGER NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                is_forwarded INTEGER DEFAULT 0,
                reply_to TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
            CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
            
            -- Contacts table
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                name TEXT,
                push_name TEXT,
                phone_number TEXT UNIQUE,
                profile_pic_url TEXT,
                status TEXT,
                is_blocked INTEGER DEFAULT 0,
                is_business INTEGER DEFAULT 0,
                is_group INTEGER DEFAULT 0,
                first_interaction TEXT,
                last_interaction TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
            
            -- Behavior profiles table
            CREATE TABLE IF NOT EXISTS behavior_profiles (
                contact_id TEXT PRIMARY KEY,
                engagement_score REAL DEFAULT 0,
                ghosting_score REAL DEFAULT 0,
                activity_heatmap TEXT,
                response_times TEXT,
                last_received_at TEXT,
                last_sent_at TEXT,
                total_messages INTEGER DEFAULT 0,
                avg_response_time REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (contact_id) REFERENCES contacts(id)
            );
            
            -- ACK logs table (forensics)
            CREATE TABLE IF NOT EXISTS ack_logs (
                id TEXT PRIMARY KEY,
                message_id TEXT NOT NULL,
                contact_id TEXT NOT NULL,
                ack_level INTEGER NOT NULL,
                previous_level INTEGER,
                latency_ms INTEGER,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (message_id) REFERENCES messages(id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_ack_logs_message ON ack_logs(message_id);
            CREATE INDEX IF NOT EXISTS idx_ack_logs_contact ON ack_logs(contact_id);
            
            -- Call logs table (forensics)
            CREATE TABLE IF NOT EXISTS call_logs (
                id TEXT PRIMARY KEY,
                contact_id TEXT NOT NULL,
                type TEXT NOT NULL,
                is_group INTEGER DEFAULT 0,
                action TEXT NOT NULL,
                duration INTEGER,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (contact_id) REFERENCES contacts(id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_call_logs_contact ON call_logs(contact_id);
            
            -- Presence logs table (forensics)
            CREATE TABLE IF NOT EXISTS presence_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id TEXT NOT NULL,
                status TEXT NOT NULL,
                duration INTEGER,
                timestamp TEXT NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_presence_logs_contact ON presence_logs(contact_id);
            CREATE INDEX IF NOT EXISTS idx_presence_logs_timestamp ON presence_logs(timestamp);
            
            -- Deleted messages (anti-delete)
            CREATE TABLE IF NOT EXISTS deleted_messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                sender TEXT NOT NULL,
                body TEXT,
                type TEXT,
                has_media INTEGER DEFAULT 0,
                original_timestamp TEXT,
                deleted_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            
            -- View-once media captures
            CREATE TABLE IF NOT EXISTS viewonce_media (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                sender TEXT NOT NULL,
                type TEXT NOT NULL,
                saved_path TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        this.logger.debug('Database tables created/verified');
    }
}

// Singleton export
let dbManager: DatabaseManager | null = null;

export function getDatabaseManager(config: Config, logger: Logger): DatabaseManager {
    if (!dbManager) {
        dbManager = new DatabaseManager(config, logger);
    }
    return dbManager;
}
