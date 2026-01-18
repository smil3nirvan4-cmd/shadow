/**
 * JARVIS ULTIMATE - Repository Interfaces
 * 
 * Abstractions for data persistence.
 */

import { Message } from '../message/message.entity.js';
import { Contact } from '../contact/contact.entity.js';
import { Call } from '../call/call.entity.js';
import { PresenceEvent, PresenceStatus } from '../presence/presence.entity.js';
import { BehaviorProfile } from '../analytics/behavior-profile.entity.js';
import { AckLevel } from '../message/message.entity.js';

// ============================================
// Base Repository Interface
// ============================================

export interface FindOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    order?: 'asc' | 'desc';
}

export interface Repository<T, ID = string> {
    findById(id: ID): Promise<T | null>;
    findAll(options?: FindOptions): Promise<T[]>;
    save(entity: T): Promise<void>;
    delete(id: ID): Promise<boolean>;
    exists(id: ID): Promise<boolean>;
    count(filter?: Record<string, unknown>): Promise<number>;
}

// ============================================
// Message Repository
// ============================================

export interface MessageStats {
    total: number;
    received: number;
    sent: number;
    media: number;
    commands: number;
}

export interface MessageRepository extends Repository<Message> {
    findByChatId(chatId: string, options?: FindOptions): Promise<Message[]>;
    findByDateRange(start: Date, end: Date): Promise<Message[]>;
    findRecent(chatId: string, limit?: number): Promise<Message[]>;
    updateAck(messageId: string, ack: AckLevel): Promise<void>;
    findRevoked(): Promise<Message[]>;
    getStatsByChat(chatId: string): Promise<MessageStats>;
    search(query: string, chatId?: string): Promise<Message[]>;
}

// ============================================
// Contact Repository
// ============================================

export interface ContactRepository extends Repository<Contact> {
    findByPhoneNumber(phone: string): Promise<Contact | null>;
    findActive(since: Date): Promise<Contact[]>;
    updateLastInteraction(contactId: string, date: Date): Promise<void>;
    search(query: string): Promise<Contact[]>;
    findBlocked(): Promise<Contact[]>;
    getAll(): Promise<Contact[]>;
}

// ============================================
// Call Repository
// ============================================

export interface CallStats {
    total: number;
    answered: number;
    missed: number;
    rejected: number;
    totalDuration: number;
    averageDuration: number;
}

export interface CallRepository extends Repository<Call> {
    findByContact(contactId: string, options?: FindOptions): Promise<Call[]>;
    findByDateRange(start: Date, end: Date): Promise<Call[]>;
    findRecent(limit?: number): Promise<Call[]>;
    getStatsByContact(contactId: string): Promise<CallStats>;
    findMissed(): Promise<Call[]>;
}

// ============================================
// Presence Repository
// ============================================

export interface PresenceRepository {
    record(event: PresenceEvent): Promise<void>;
    getHistory(contactId: string, since: Date): Promise<PresenceEvent[]>;
    getLastStatus(contactId: string): Promise<PresenceEvent | null>;
    getOnlineContacts(): Promise<string[]>;
    findByStatus(status: PresenceStatus): Promise<PresenceEvent[]>;
    cleanup(before: Date): Promise<number>;
}

// ============================================
// Behavior Profile Repository
// ============================================

export interface BehaviorProfileRepository extends Repository<BehaviorProfile> {
    findByContact(contactId: string): Promise<BehaviorProfile | null>;
    updateMetrics(
        contactId: string,
        metrics: Partial<{
            totalMessages: number;
            totalCalls: number;
            authenticityScore: number;
            engagementScore: number;
        }>
    ): Promise<void>;
    getTopEngaged(limit: number): Promise<BehaviorProfile[]>;
    getByScoreRange(min: number, max: number): Promise<BehaviorProfile[]>;
}

// ============================================
// ACK Log Repository (for forensics)
// ============================================

export interface AckLog {
    id: string;
    messageId: string;
    contactId: string;
    ackLevel: AckLevel;
    timestamp: Date;
    previousLevel?: AckLevel;
    latencyMs?: number;
}

export interface AckLogRepository {
    record(log: AckLog): Promise<void>;
    findByMessage(messageId: string): Promise<AckLog[]>;
    findByContact(contactId: string, since?: Date): Promise<AckLog[]>;
    getReadLatency(messageId: string): Promise<number | null>;
    getAverageReadLatency(contactId: string): Promise<number>;
}
