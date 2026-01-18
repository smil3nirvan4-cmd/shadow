/**
 * JARVIS ULTIMATE - God Mode Config Entity
 * 
 * Baseado no código REAL de god_mode.js
 * Configurações para funcionalidades forenses avançadas
 */

import { z } from 'zod';
import { ValidationError, Result, ok, fail } from '../../core/errors.js';

// ============================================
// Schema (Baseado no Original)
// ============================================

const GodModeConfigSchema = z.object({
    // === CORE STEALTH (do original) ===
    ghostMode: z.boolean().default(false),           // Não enviar ACKs de leitura
    viewOnceBypass: z.boolean().default(false),      // Salvar mídia "ver uma vez"
    antiDelete: z.boolean().default(false),          // Capturar msgs deletadas

    // === MEDIA (do original) ===
    saveStickers: z.boolean().default(false),        // Baixar stickers
    saveStatus: z.boolean().default(false),          // Salvar status/stories

    // === CALL HANDLING (do original) ===
    autoRejectCalls: z.boolean().default(false),     // Rejeitar chamadas auto
    callRejectMessage: z.string().default('⚠️ Não posso atender agora. Me mande uma mensagem!'),

    // === STALKING (do original) ===
    stalking: z.array(z.string()).default([]),       // Números para monitorar presença
    stalkingInterval: z.number().default(30000),     // Intervalo de check (ms)

    // === SPYING (do original) ===
    ackSpy: z.boolean().default(false),              // Log de confirmação de leitura
    reactionSpy: z.boolean().default(true),          // Log de reações
    presenceSpy: z.boolean().default(false),         // Log de presença

    // === LIMITS (do original) ===
    viewOnceHistoryLimit: z.number().default(50),
    maxStalkedContacts: z.number().default(20),
    logRetentionDays: z.number().default(30),

    // === TIMESTAMPS ===
    createdAt: z.date().default(() => new Date()),
    updatedAt: z.date().default(() => new Date()),
});

export type GodModeConfigProps = z.infer<typeof GodModeConfigSchema>;

// ============================================
// Entity
// ============================================

export class GodModeConfig {
    private constructor(private readonly props: GodModeConfigProps) { }

    static create(props: Partial<GodModeConfigProps> = {}): Result<GodModeConfig> {
        const result = GodModeConfigSchema.safeParse(props);

        if (!result.success) {
            return fail(
                new ValidationError('Invalid god mode config', {
                    errors: result.error.format(),
                })
            );
        }

        return ok(new GodModeConfig(result.data));
    }

    static default(): GodModeConfig {
        const result = GodModeConfig.create({});
        if (!result.success) throw result.error;
        return result.data;
    }

    // ==========================================
    // Getters
    // ==========================================

    get ghostMode(): boolean { return this.props.ghostMode; }
    get viewOnceBypass(): boolean { return this.props.viewOnceBypass; }
    get antiDelete(): boolean { return this.props.antiDelete; }
    get saveStickers(): boolean { return this.props.saveStickers; }
    get saveStatus(): boolean { return this.props.saveStatus; }
    get autoRejectCalls(): boolean { return this.props.autoRejectCalls; }
    get callRejectMessage(): string { return this.props.callRejectMessage; }
    get stalking(): string[] { return [...this.props.stalking]; }
    get ackSpy(): boolean { return this.props.ackSpy; }
    get reactionSpy(): boolean { return this.props.reactionSpy; }
    get presenceSpy(): boolean { return this.props.presenceSpy; }

    // ==========================================
    // Modifiers
    // ==========================================

    setGhostMode(enabled: boolean): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            ghostMode: enabled,
            updatedAt: new Date(),
        });
    }

    setViewOnceBypass(enabled: boolean): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            viewOnceBypass: enabled,
            updatedAt: new Date(),
        });
    }

    setAntiDelete(enabled: boolean): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            antiDelete: enabled,
            updatedAt: new Date(),
        });
    }

    setAutoRejectCalls(enabled: boolean, message?: string): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            autoRejectCalls: enabled,
            callRejectMessage: message || this.props.callRejectMessage,
            updatedAt: new Date(),
        });
    }

    // ==========================================
    // Stalking Management
    // ==========================================

    addStalkTarget(contactId: string): GodModeConfig {
        if (this.props.stalking.includes(contactId)) {
            return this;
        }

        if (this.props.stalking.length >= this.props.maxStalkedContacts) {
            throw new Error(`Maximum stalking targets (${this.props.maxStalkedContacts}) reached`);
        }

        return new GodModeConfig({
            ...this.props,
            stalking: [...this.props.stalking, contactId],
            updatedAt: new Date(),
        });
    }

    removeStalkTarget(contactId: string): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            stalking: this.props.stalking.filter(id => id !== contactId),
            updatedAt: new Date(),
        });
    }

    isStalkingContact(contactId: string): boolean {
        return this.props.stalking.includes(contactId);
    }

    clearAllStalkTargets(): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            stalking: [],
            updatedAt: new Date(),
        });
    }

    // ==========================================
    // Spy Settings
    // ==========================================

    setAckSpy(enabled: boolean): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            ackSpy: enabled,
            updatedAt: new Date(),
        });
    }

    setReactionSpy(enabled: boolean): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            reactionSpy: enabled,
            updatedAt: new Date(),
        });
    }

    setPresenceSpy(enabled: boolean): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            presenceSpy: enabled,
            updatedAt: new Date(),
        });
    }

    // ==========================================
    // Bulk Update
    // ==========================================

    update(changes: Partial<GodModeConfigProps>): GodModeConfig {
        return new GodModeConfig({
            ...this.props,
            ...changes,
            updatedAt: new Date(),
        });
    }

    // ==========================================
    // Status
    // ==========================================

    getActiveFeatures(): string[] {
        const features: string[] = [];

        if (this.props.ghostMode) features.push('Ghost Mode');
        if (this.props.viewOnceBypass) features.push('ViewOnce Bypass');
        if (this.props.antiDelete) features.push('Anti-Delete');
        if (this.props.saveStickers) features.push('Save Stickers');
        if (this.props.saveStatus) features.push('Save Status');
        if (this.props.autoRejectCalls) features.push('Auto Reject Calls');
        if (this.props.ackSpy) features.push('ACK Spy');
        if (this.props.reactionSpy) features.push('Reaction Spy');
        if (this.props.presenceSpy) features.push('Presence Spy');
        if (this.props.stalking.length > 0) features.push(`Stalking (${this.props.stalking.length})`);

        return features;
    }

    isFeatureActive(feature: keyof GodModeConfigProps): boolean {
        const value = this.props[feature];
        if (typeof value === 'boolean') return value;
        if (Array.isArray(value)) return value.length > 0;
        return false;
    }

    // ==========================================
    // Serialization
    // ==========================================

    toJSON(): GodModeConfigProps {
        return { ...this.props };
    }

    toSummary(): Record<string, unknown> {
        return {
            ghostMode: this.props.ghostMode,
            viewOnceBypass: this.props.viewOnceBypass,
            antiDelete: this.props.antiDelete,
            autoRejectCalls: this.props.autoRejectCalls,
            stalkingCount: this.props.stalking.length,
            ackSpy: this.props.ackSpy,
            reactionSpy: this.props.reactionSpy,
            activeFeatures: this.getActiveFeatures(),
        };
    }
}
