/**
 * JARVIS ULTIMATE - Behavior Profile Entity (CORRIGIDO)
 * 
 * Baseado no código REAL de behavioral_analytics.js
 * Inclui: activity heatmap, ghosting detection, response times, predictions
 */

import { z } from 'zod';
import { ValidationError, Result, ok, fail } from '../../core/errors.js';

// ============================================
// Tipos Específicos
// ============================================

export type InterestLevel = 'rising' | 'stable' | 'declining';
export type PredictionConfidence = 'high' | 'medium' | 'low';

export interface ContactPrediction {
    probability: number;
    reason: string;
    confidence: PredictionConfidence;
    window: string; // "próximas 2h", etc
}

export interface BehaviorAnomaly {
    type: 'response_slowdown' | 'activity_drop' | 'pattern_change' | 'ghosting_start';
    severity: 'low' | 'medium' | 'high';
    detectedAt: Date;
    description: string;
    baseline: number;
    current: number;
}

// ============================================
// Schema (Baseado no Original)
// ============================================

// Heatmap: 7 dias x 24 horas
const HeatmapRowSchema = z.array(z.number()).length(24);
const ActivityHeatmapSchema = z.array(HeatmapRowSchema).length(7);

const BehaviorProfileSchema = z.object({
    id: z.string().default(() => `profile_${Date.now()}`),
    contactId: z.string().min(1),

    // === ACTIVITY HEATMAP (do original) ===
    // Matriz 7x24: [dia_semana][hora] = contagem
    activityHeatmap: ActivityHeatmapSchema.default(() =>
        Array(7).fill(null).map(() => Array(24).fill(0))
    ),

    // === RESPONSE TIMES (do original) ===
    myResponseTimes: z.array(z.number()).default([]),     // segundos que EU demoro
    theirResponseTimes: z.array(z.number()).default([]),  // segundos que ELES demoram
    avgMyResponseTime: z.number().default(0),
    avgTheirResponseTime: z.number().default(0),

    // === MESSAGE METRICS (do original) ===
    messagesSent: z.number().default(0),
    messagesReceived: z.number().default(0),
    avgMessageLength: z.array(z.number()).default([]),  // Últimos N comprimentos
    emojiUsage: z.array(z.number()).default([]),        // Contagem de emojis por msg

    // === GHOSTING DETECTION (do original) ===
    ghostingScore: z.number().min(0).max(100).default(0),
    lastGhostingCheck: z.date().optional(),
    ghostingTrend: z.enum(['improving', 'stable', 'worsening']).default('stable'),

    // === INTEREST LEVEL (do original) ===
    interestLevel: z.enum(['rising', 'stable', 'declining']).default('stable'),
    interestHistory: z.array(z.object({
        level: z.enum(['rising', 'stable', 'declining']),
        timestamp: z.date(),
    })).default([]),

    // === ENGAGEMENT SCORE (do original) ===
    engagementScore: z.number().min(0).max(100).default(50),

    // === PREDICTIONS (do original) ===
    predictedNextContact: z.object({
        probability: z.number(),
        reason: z.string(),
        confidence: z.enum(['high', 'medium', 'low']),
        window: z.string(),
    }).optional(),
    contactProbability: z.number().min(0).max(100).default(0),

    // === ANOMALIES (do original) ===
    anomalies: z.array(z.object({
        type: z.enum(['response_slowdown', 'activity_drop', 'pattern_change', 'ghosting_start']),
        severity: z.enum(['low', 'medium', 'high']),
        detectedAt: z.date(),
        description: z.string(),
        baseline: z.number(),
        current: z.number(),
    })).default([]),

    // === OPTIMAL REPLY TIME (do original) ===
    optimalReplyWindow: z.object({
        start: z.number().min(0).max(23),
        end: z.number().min(0).max(23),
        confidence: z.number(),
    }).optional(),

    // === TIMESTAMPS ===
    lastSentAt: z.date().optional(),
    lastReceivedAt: z.date().optional(),
    firstInteraction: z.date().optional(),
    createdAt: z.date().default(() => new Date()),
    updatedAt: z.date().default(() => new Date()),

    // === METADATA ===
    metadata: z.record(z.unknown()).default({}),
});

export type BehaviorProfileProps = z.infer<typeof BehaviorProfileSchema>;

// ============================================
// Entity
// ============================================

export class BehaviorProfile {
    private constructor(private readonly props: BehaviorProfileProps) { }

    static create(props: unknown): Result<BehaviorProfile> {
        const result = BehaviorProfileSchema.safeParse(props);

        if (!result.success) {
            return fail(
                new ValidationError('Invalid behavior profile data', {
                    errors: result.error.format(),
                })
            );
        }

        return ok(new BehaviorProfile(result.data));
    }

    static empty(contactId: string): BehaviorProfile {
        const result = BehaviorProfile.create({ contactId });
        if (!result.success) throw result.error;
        return result.data;
    }

    // ==========================================
    // Getters
    // ==========================================

    get id(): string { return this.props.id; }
    get contactId(): string { return this.props.contactId; }
    get activityHeatmap(): number[][] { return this.props.activityHeatmap.map(r => [...r]); }
    get myResponseTimes(): number[] { return [...this.props.myResponseTimes]; }
    get theirResponseTimes(): number[] { return [...this.props.theirResponseTimes]; }
    get messagesSent(): number { return this.props.messagesSent; }
    get messagesReceived(): number { return this.props.messagesReceived; }
    get ghostingScore(): number { return this.props.ghostingScore; }
    get interestLevel(): InterestLevel { return this.props.interestLevel; }
    get engagementScore(): number { return this.props.engagementScore; }
    get predictedNextContact(): ContactPrediction | undefined { return this.props.predictedNextContact; }
    get contactProbability(): number { return this.props.contactProbability; }
    get anomalies(): BehaviorAnomaly[] { return [...this.props.anomalies]; }
    get optimalReplyWindow() { return this.props.optimalReplyWindow; }
    get lastSentAt(): Date | undefined { return this.props.lastSentAt; }
    get lastReceivedAt(): Date | undefined { return this.props.lastReceivedAt; }

    // ==========================================
    // ACTIVITY HEATMAP LOGIC (do original)
    // ==========================================

    /**
     * Registra atividade no heatmap (como no original)
     */
    recordActivity(dayOfWeek: number, hour: number): BehaviorProfile {
        const newHeatmap = this.props.activityHeatmap.map(row => [...row]);
        newHeatmap[dayOfWeek][hour]++;

        return new BehaviorProfile({
            ...this.props,
            activityHeatmap: newHeatmap,
            updatedAt: new Date(),
        });
    }

    /**
     * Retorna probabilidade de estar online em horário específico
     */
    getOnlineProbability(dayOfWeek: number, hour: number): number {
        const totalActivity = this.props.activityHeatmap.flat().reduce((a, b) => a + b, 0);
        if (totalActivity === 0) return 0;
        return (this.props.activityHeatmap[dayOfWeek][hour] / totalActivity) * 100;
    }

    /**
     * Encontra horário de pico de atividade
     */
    getPeakActivityTime(): { day: number; hour: number; count: number } {
        let peak = { day: 0, hour: 0, count: 0 };

        this.props.activityHeatmap.forEach((row, day) => {
            row.forEach((count, hour) => {
                if (count > peak.count) {
                    peak = { day, hour, count };
                }
            });
        });

        return peak;
    }

    // ==========================================
    // RESPONSE TIME LOGIC (do original)
    // ==========================================

    /**
     * Registra tempo de resposta meu
     */
    recordMyResponseTime(seconds: number): BehaviorProfile {
        const times = [...this.props.myResponseTimes, seconds];
        if (times.length > 100) times.shift();

        const avg = times.reduce((a, b) => a + b, 0) / times.length;

        return new BehaviorProfile({
            ...this.props,
            myResponseTimes: times,
            avgMyResponseTime: avg,
            updatedAt: new Date(),
        });
    }

    /**
     * Registra tempo de resposta deles
     */
    recordTheirResponseTime(seconds: number): BehaviorProfile {
        const times = [...this.props.theirResponseTimes, seconds];
        if (times.length > 100) times.shift();

        const avg = times.reduce((a, b) => a + b, 0) / times.length;

        // Detectar mudança de padrão (do original)
        const anomaly = this.detectResponsePatternChange(seconds);

        return new BehaviorProfile({
            ...this.props,
            theirResponseTimes: times,
            avgTheirResponseTime: avg,
            anomalies: anomaly ? [...this.props.anomalies, anomaly] : this.props.anomalies,
            updatedAt: new Date(),
        });
    }

    private detectResponsePatternChange(newTime: number): BehaviorAnomaly | null {
        if (this.props.theirResponseTimes.length < 10) return null;

        const recentAvg = this.calculateAvg(this.props.theirResponseTimes.slice(-5));
        const historicalAvg = this.calculateAvg(this.props.theirResponseTimes.slice(0, -5));

        if (newTime > historicalAvg * 3 && recentAvg > historicalAvg * 2) {
            return {
                type: 'response_slowdown',
                severity: newTime > historicalAvg * 5 ? 'high' : 'medium',
                detectedAt: new Date(),
                description: `Tempo de resposta aumentou ${Math.round(recentAvg / historicalAvg)}x`,
                baseline: historicalAvg,
                current: recentAvg,
            };
        }

        return null;
    }

    // ==========================================
    // GHOSTING DETECTION (do original)
    // ==========================================

    /**
     * Atualiza score de ghosting (0-100)
     */
    updateGhostingScore(): BehaviorProfile {
        const now = new Date();
        let score = 0;

        // Fator 1: Tempo desde última mensagem recebida
        if (this.props.lastReceivedAt) {
            const hoursSince = (now.getTime() - this.props.lastReceivedAt.getTime()) / (1000 * 60 * 60);

            // Mais de 24h sem resposta = +30 pontos
            if (hoursSince > 24) score += Math.min(30, hoursSince / 24 * 10);

            // Mais de 72h = +20 pontos adicionais
            if (hoursSince > 72) score += 20;
        }

        // Fator 2: Desequilíbrio de mensagens
        const total = this.props.messagesSent + this.props.messagesReceived;
        if (total > 10) {
            const ratio = this.props.messagesSent / (this.props.messagesReceived || 1);
            if (ratio > 2) score += Math.min(25, (ratio - 2) * 10);
        }

        // Fator 3: Tempo de resposta crescente
        if (this.props.theirResponseTimes.length >= 5) {
            const recentAvg = this.calculateAvg(this.props.theirResponseTimes.slice(-3));
            const oldAvg = this.calculateAvg(this.props.theirResponseTimes.slice(0, 3));

            if (recentAvg > oldAvg * 2) {
                score += Math.min(25, ((recentAvg / oldAvg) - 1) * 10);
            }
        }

        score = Math.min(100, Math.max(0, score));

        // Detectar início de ghosting
        const wasGhosting = this.props.ghostingScore >= 50;
        const isGhosting = score >= 50;

        let anomalies = [...this.props.anomalies];
        if (!wasGhosting && isGhosting) {
            anomalies.push({
                type: 'ghosting_start',
                severity: score >= 70 ? 'high' : 'medium',
                detectedAt: now,
                description: 'Possível ghosting detectado',
                baseline: this.props.ghostingScore,
                current: score,
            });
        }

        // Determinar trend
        let trend: 'improving' | 'stable' | 'worsening' = 'stable';
        if (score > this.props.ghostingScore + 10) trend = 'worsening';
        if (score < this.props.ghostingScore - 10) trend = 'improving';

        return new BehaviorProfile({
            ...this.props,
            ghostingScore: score,
            ghostingTrend: trend,
            lastGhostingCheck: now,
            anomalies,
            updatedAt: now,
        });
    }

    // ==========================================
    // INTEREST LEVEL (do original)
    // ==========================================

    /**
     * Calcula nível de interesse baseado em métricas
     */
    updateInterestLevel(): BehaviorProfile {
        const now = new Date();
        let level: InterestLevel = 'stable';

        // Analisar últimas 5 vs primeiras 5 respostas
        if (this.props.theirResponseTimes.length >= 10) {
            const recent = this.calculateAvg(this.props.theirResponseTimes.slice(-5));
            const old = this.calculateAvg(this.props.theirResponseTimes.slice(0, 5));

            if (recent < old * 0.7) level = 'rising';      // Respondendo mais rápido
            if (recent > old * 1.5) level = 'declining';   // Respondendo mais devagar
        }

        // Analisar frequência de mensagens
        const recentActivity = this.getRecentActivityCount(7);  // Última semana
        const oldActivity = this.getOldActivityCount(7);        // Semana anterior

        if (recentActivity > oldActivity * 1.3) level = 'rising';
        if (recentActivity < oldActivity * 0.7) level = 'declining';

        const history = [...this.props.interestHistory, { level, timestamp: now }];
        if (history.length > 30) history.shift();

        return new BehaviorProfile({
            ...this.props,
            interestLevel: level,
            interestHistory: history,
            updatedAt: now,
        });
    }

    private getRecentActivityCount(days: number): number {
        // Soma atividade dos últimos N dias do heatmap
        const today = new Date().getDay();
        let count = 0;
        for (let i = 0; i < days && i < 7; i++) {
            const day = (today - i + 7) % 7;
            count += this.props.activityHeatmap[day].reduce((a, b) => a + b, 0);
        }
        return count;
    }

    private getOldActivityCount(days: number): number {
        // Aproximação baseada no total
        const total = this.props.activityHeatmap.flat().reduce((a, b) => a + b, 0);
        return total / 2; // Metade como "período anterior"
    }

    // ==========================================
    // ENGAGEMENT SCORE (do original)
    // ==========================================

    /**
     * Calcula score de engajamento (0-100)
     */
    calculateEngagementScore(): BehaviorProfile {
        let score = 50; // Base

        // Frequência de mensagens recebidas
        const msgsPerDay = this.props.messagesReceived /
            Math.max(1, this.daysSinceCreation());
        score += Math.min(20, msgsPerDay * 5);

        // Tempo de resposta baixo = +pontos
        if (this.props.avgTheirResponseTime > 0 && this.props.avgTheirResponseTime < 300) {
            score += 15;
        }

        // Interest level
        if (this.props.interestLevel === 'rising') score += 10;
        if (this.props.interestLevel === 'declining') score -= 10;

        // Ghosting penaliza
        score -= this.props.ghostingScore * 0.3;

        score = Math.min(100, Math.max(0, score));

        return new BehaviorProfile({
            ...this.props,
            engagementScore: Math.round(score),
            updatedAt: new Date(),
        });
    }

    // ==========================================
    // PREDICTIONS (do original)
    // ==========================================

    /**
     * Gera predição de próximo contato
     */
    generatePrediction(currentDay: number, currentHour: number): BehaviorProfile {
        const activityNow = this.props.activityHeatmap[currentDay][currentHour];
        const totalActivity = this.props.activityHeatmap.flat().reduce((a, b) => a + b, 0);

        let probability = totalActivity > 0
            ? (activityNow / totalActivity) * 100
            : 0;

        // Ajuste por tempo desde último contato
        if (this.props.lastReceivedAt) {
            const hoursSince = (Date.now() - this.props.lastReceivedAt.getTime()) / (1000 * 60 * 60);
            const avgInterval = this.getAverageContactInterval();

            if (avgInterval > 0) {
                const ratio = hoursSince / avgInterval;
                if (ratio >= 0.8 && ratio <= 1.5) probability += 20;
            }
        }

        // Boost por interest
        if (this.props.interestLevel === 'rising') probability += 15;

        // Penalidade por ghosting
        if (this.props.ghostingScore > 50) probability -= 20;

        probability = Math.max(0, Math.min(100, probability));

        const prediction: ContactPrediction | undefined = probability > 10
            ? {
                probability: Math.round(probability),
                reason: this.generatePredictionReason(activityNow),
                confidence: this.getPredictionConfidence(),
                window: 'próximas 2h',
            }
            : undefined;

        return new BehaviorProfile({
            ...this.props,
            predictedNextContact: prediction,
            contactProbability: probability,
            updatedAt: new Date(),
        });
    }

    private getAverageContactInterval(): number {
        const total = this.props.messagesReceived;
        const days = this.daysSinceCreation() || 1;
        if (total < 2) return 0;
        return (days * 24) / total;
    }

    private generatePredictionReason(activityNow: number): string {
        if (activityNow > 3) return `Historicamente ativo neste horário`;
        if (this.props.interestLevel === 'rising') return 'Engajamento crescente';
        if (this.props.engagementScore > 70) return 'Alto nível de engajamento';
        return 'Baseado em padrões de contato';
    }

    private getPredictionConfidence(): PredictionConfidence {
        const total = this.props.messagesSent + this.props.messagesReceived;
        if (total > 50) return 'high';
        if (total > 20) return 'medium';
        return 'low';
    }

    // ==========================================
    // OPTIMAL REPLY WINDOW (do original)
    // ==========================================

    /**
     * Calcula melhor janela para responder
     */
    calculateOptimalReplyWindow(): BehaviorProfile {
        // Encontrar janela de 2h com maior atividade
        let bestWindow = { start: 9, end: 11, score: 0 };

        for (let hour = 0; hour < 22; hour++) {
            let score = 0;
            for (let day = 0; day < 7; day++) {
                score += this.props.activityHeatmap[day][hour];
                score += this.props.activityHeatmap[day][hour + 1];
                score += this.props.activityHeatmap[day][(hour + 2) % 24] * 0.5;
            }

            if (score > bestWindow.score) {
                bestWindow = { start: hour, end: (hour + 2) % 24, score };
            }
        }

        return new BehaviorProfile({
            ...this.props,
            optimalReplyWindow: {
                start: bestWindow.start,
                end: bestWindow.end,
                confidence: Math.min(100, bestWindow.score * 10),
            },
            updatedAt: new Date(),
        });
    }

    // ==========================================
    // Helpers
    // ==========================================

    private calculateAvg(arr: number[]): number {
        if (arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    private daysSinceCreation(): number {
        return Math.floor(
            (Date.now() - this.props.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
    }

    // ==========================================
    // High-Level Updates
    // ==========================================

    /**
     * Registra mensagem completa (como no original)
     */
    recordMessage(fromMe: boolean, text: string, timestamp?: Date): BehaviorProfile {
        const now = timestamp || new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay();

        let updated = this.recordActivity(dayOfWeek, hour);

        if (fromMe) {
            // Eu respondendo
            if (this.props.lastReceivedAt) {
                const responseTime = Math.floor(
                    (now.getTime() - this.props.lastReceivedAt.getTime()) / 1000
                );
                updated = updated.recordMyResponseTime(responseTime);
            }
            updated = new BehaviorProfile({
                ...updated.props,
                messagesSent: updated.props.messagesSent + 1,
                lastSentAt: now,
            });
        } else {
            // Eles respondendo
            if (this.props.lastSentAt) {
                const responseTime = Math.floor(
                    (now.getTime() - this.props.lastSentAt.getTime()) / 1000
                );
                updated = updated.recordTheirResponseTime(responseTime);
            }

            // Analisar conteúdo
            const msgLength = text.length;
            const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/gu) || []).length;

            const avgMsgLen = [...updated.props.avgMessageLength, msgLength];
            const emojiUsage = [...updated.props.emojiUsage, emojiCount];
            if (avgMsgLen.length > 50) avgMsgLen.shift();
            if (emojiUsage.length > 50) emojiUsage.shift();

            updated = new BehaviorProfile({
                ...updated.props,
                messagesReceived: updated.props.messagesReceived + 1,
                lastReceivedAt: now,
                avgMessageLength: avgMsgLen,
                emojiUsage: emojiUsage,
            });
        }

        // Atualizar scores
        updated = updated.updateGhostingScore();
        updated = updated.updateInterestLevel();
        updated = updated.calculateEngagementScore();

        return updated;
    }

    // ==========================================
    // Serialization
    // ==========================================

    toJSON(): BehaviorProfileProps {
        return { ...this.props };
    }

    toSummary(): Record<string, unknown> {
        return {
            contactId: this.props.contactId,
            messagesSent: this.props.messagesSent,
            messagesReceived: this.props.messagesReceived,
            ghostingScore: this.props.ghostingScore,
            ghostingTrend: this.props.ghostingTrend,
            interestLevel: this.props.interestLevel,
            engagementScore: this.props.engagementScore,
            contactProbability: this.props.contactProbability,
            peakActivity: this.getPeakActivityTime(),
            optimalWindow: this.props.optimalReplyWindow,
            anomalyCount: this.props.anomalies.length,
        };
    }
}
