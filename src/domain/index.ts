/**
 * JARVIS ULTIMATE - Domain Exports
 */

// Entities
export * from './message/message.entity.js';
export * from './contact/contact.entity.js';
export * from './call/call.entity.js';
export * from './presence/presence.entity.js';

// Analytics (CORRIGIDO)
export * from './analytics/index.js';

// Forensics (NOVO)
export * from './forensics/index.js';

// Profiling (NOVO)
export * from './profiling/index.js';

// Writing Analysis (NOVO)
export * from './writing/index.js';

// AI
export * from './ai/ai.types.js';
export * from './ai/ai.service.js';

// Shared (excluding AckLog which is already exported from forensics)
export {
    FindOptions,
    Repository,
    MessageStats,
    MessageRepository,
    ContactRepository,
    CallRepository,
    PresenceRepository,
    BehaviorProfileRepository,
    AckLogRepository,
} from './shared/repository.interface.js';
