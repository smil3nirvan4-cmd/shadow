/**
 * JARVIS ULTIMATE - Behavioral Analytics Service
 * 
 * Baseado no código REAL de behavioral_analytics.js
 * Orquestra: predictions, anomaly detection, ghosting alerts
 */

import { injectable } from 'tsyringe';
import { EventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { BehaviorProfile, ContactPrediction, BehaviorAnomaly } from './behavior-profile.entity.js';

// ============================================
// Types
// ============================================

export interface ContactPredictionResult {
    contactId: string;
    probability: number;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface GhostingAlert {
    contactId: string;
    score: number;
    trend: 'improving' | 'stable' | 'worsening';
    lastContact: Date | null;
    daysSinceContact: number;
    severity: 'low' | 'medium' | 'high';
}

export interface AnalyticsSummary {
    totalContacts: number;
    highEngagement: number;
    potentialGhosting: number;
    predictions: ContactPredictionResult[];
    recentAnomalies: BehaviorAnomaly[];
}

// ============================================
// Service
// ============================================

@injectable()
export class BehavioralAnalyticsService {
    private profiles: Map<string, BehaviorProfile> = new Map();

    constructor(
        private readonly eventBus: EventBus,
        private readonly logger: Logger,
    ) {
        // Run predictions periodically
        setInterval(() => this.generateAllPredictions(), 15 * 60 * 1000); // 15 min
    }

    // ==========================================
    // Profile Management
    // ==========================================

    getOrCreateProfile(contactId: string): BehaviorProfile {
        let profile = this.profiles.get(contactId);

        if (!profile) {
            profile = BehaviorProfile.empty(contactId);
            this.profiles.set(contactId, profile);
        }

        return profile;
    }

    getProfile(contactId: string): BehaviorProfile | null {
        return this.profiles.get(contactId) || null;
    }

    getAllProfiles(): BehaviorProfile[] {
        return Array.from(this.profiles.values());
    }

    // ==========================================
    // Message Processing (do original registrarMensagem)
    // ==========================================

    recordMessage(contactId: string, text: string, fromMe: boolean, timestamp?: Date): BehaviorProfile {
        let profile = this.getOrCreateProfile(contactId);

        profile = profile.recordMessage(fromMe, text, timestamp);
        this.profiles.set(contactId, profile);

        // Check for anomalies
        const recentAnomalies = profile.anomalies.filter(
            a => Date.now() - a.detectedAt.getTime() < 60000 // Last minute
        );

        if (recentAnomalies.length > 0) {
            this.eventBus.emit('analytics:anomaly_detected', {
                contactId,
                anomalies: recentAnomalies,
            });
        }

        // Check ghosting threshold
        if (profile.ghostingScore >= 50 && !fromMe) {
            this.eventBus.emit('analytics:ghosting_alert', {
                contactId,
                score: profile.ghostingScore,
            });
        }

        this.logger.debug(`[Analytics] Recorded message for ${contactId}`, {
            fromMe,
            ghostingScore: profile.ghostingScore,
            interestLevel: profile.interestLevel,
        });

        return profile;
    }

    // ==========================================
    // PREDICTIONS (do original generatePredictions)
    // ==========================================

    generateAllPredictions(): ContactPredictionResult[] {
        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = now.getHours();

        const predictions: ContactPredictionResult[] = [];

        this.profiles.forEach((profile, contactId) => {
            const updated = profile.generatePrediction(currentDay, currentHour);
            this.profiles.set(contactId, updated);

            const pred = updated.predictedNextContact;
            if (pred && pred.probability > 10) {
                predictions.push({
                    contactId,
                    probability: pred.probability,
                    reason: pred.reason,
                    confidence: pred.confidence,
                });
            }
        });

        // Sort by probability
        predictions.sort((a, b) => b.probability - a.probability);

        // Emit top predictions
        if (predictions.length > 0) {
            this.eventBus.emit('analytics:predictions_generated', {
                predictions: predictions.slice(0, 5),
            });
        }

        this.logger.info(`[Analytics] Generated ${predictions.length} predictions`);
        return predictions.slice(0, 10);
    }

    getPredictions(): ContactPredictionResult[] {
        const results: ContactPredictionResult[] = [];

        this.profiles.forEach((profile, contactId) => {
            if (profile.contactProbability > 10) {
                const pred = profile.predictedNextContact;
                results.push({
                    contactId,
                    probability: profile.contactProbability,
                    reason: pred?.reason || 'Pattern-based',
                    confidence: pred?.confidence || 'low',
                });
            }
        });

        return results.sort((a, b) => b.probability - a.probability).slice(0, 10);
    }

    // ==========================================
    // GHOSTING DETECTION (do original)
    // ==========================================

    getGhostingAlerts(): GhostingAlert[] {
        const alerts: GhostingAlert[] = [];

        this.profiles.forEach((profile, contactId) => {
            if (profile.ghostingScore >= 30) {
                const lastContact = profile.lastReceivedAt;
                const daysSince = lastContact
                    ? Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
                    : 999;

                alerts.push({
                    contactId,
                    score: profile.ghostingScore,
                    trend: profile.toJSON().ghostingTrend,
                    lastContact: lastContact || null,
                    daysSinceContact: daysSince,
                    severity: profile.ghostingScore >= 70 ? 'high'
                        : profile.ghostingScore >= 50 ? 'medium'
                            : 'low',
                });
            }
        });

        return alerts.sort((a, b) => b.score - a.score);
    }

    checkGhostingStatus(contactId: string): GhostingAlert | null {
        const profile = this.profiles.get(contactId);
        if (!profile) return null;

        const lastContact = profile.lastReceivedAt;
        const daysSince = lastContact
            ? Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
            : 999;

        return {
            contactId,
            score: profile.ghostingScore,
            trend: profile.toJSON().ghostingTrend,
            lastContact: lastContact || null,
            daysSinceContact: daysSince,
            severity: profile.ghostingScore >= 70 ? 'high'
                : profile.ghostingScore >= 50 ? 'medium'
                    : 'low',
        };
    }

    // ==========================================
    // ANOMALY DETECTION (do original detectAnomalies)
    // ==========================================

    getRecentAnomalies(hoursBack = 24): BehaviorAnomaly[] {
        const cutoff = Date.now() - (hoursBack * 60 * 60 * 1000);
        const all: BehaviorAnomaly[] = [];

        this.profiles.forEach(profile => {
            profile.anomalies
                .filter(a => a.detectedAt.getTime() > cutoff)
                .forEach(a => all.push(a));
        });

        return all.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
    }

    getAnomaliesForContact(contactId: string): BehaviorAnomaly[] {
        const profile = this.profiles.get(contactId);
        return profile?.anomalies || [];
    }

    // ==========================================
    // OPTIMAL REPLY TIME (do original)
    // ==========================================

    getOptimalReplyTime(contactId: string): { window: string; confidence: number } | null {
        const profile = this.profiles.get(contactId);
        if (!profile) return null;

        const updated = profile.calculateOptimalReplyWindow();
        this.profiles.set(contactId, updated);

        const window = updated.optimalReplyWindow;
        if (!window) return null;

        return {
            window: `${window.start}h - ${window.end}h`,
            confidence: window.confidence,
        };
    }

    // ==========================================
    // ENGAGEMENT RANKING (do original)
    // ==========================================

    getTopEngagedContacts(limit = 10): Array<{ contactId: string; score: number; level: string }> {
        const ranked = Array.from(this.profiles.entries())
            .map(([contactId, profile]) => ({
                contactId,
                score: profile.engagementScore,
                level: profile.interestLevel,
            }))
            .sort((a, b) => b.score - a.score);

        return ranked.slice(0, limit);
    }

    getDecliningContacts(): Array<{ contactId: string; score: number }> {
        return Array.from(this.profiles.entries())
            .filter(([_, profile]) => profile.interestLevel === 'declining')
            .map(([contactId, profile]) => ({
                contactId,
                score: profile.engagementScore,
            }))
            .sort((a, b) => a.score - b.score);
    }

    getRisingContacts(): Array<{ contactId: string; score: number }> {
        return Array.from(this.profiles.entries())
            .filter(([_, profile]) => profile.interestLevel === 'rising')
            .map(([contactId, profile]) => ({
                contactId,
                score: profile.engagementScore,
            }))
            .sort((a, b) => b.score - a.score);
    }

    // ==========================================
    // SUMMARY (do original)
    // ==========================================

    getSummary(): AnalyticsSummary {
        const profiles = Array.from(this.profiles.values());

        return {
            totalContacts: profiles.length,
            highEngagement: profiles.filter(p => p.engagementScore >= 70).length,
            potentialGhosting: profiles.filter(p => p.ghostingScore >= 50).length,
            predictions: this.getPredictions(),
            recentAnomalies: this.getRecentAnomalies(24),
        };
    }

    // ==========================================
    // HEATMAP DATA (do original)
    // ==========================================

    getActivityHeatmap(contactId: string): number[][] | null {
        const profile = this.profiles.get(contactId);
        return profile?.activityHeatmap || null;
    }

    getGlobalHeatmap(): number[][] {
        // Aggregate all profiles into one heatmap
        const global = Array(7).fill(null).map(() => Array(24).fill(0));

        this.profiles.forEach(profile => {
            const heatmap = profile.activityHeatmap;
            for (let day = 0; day < 7; day++) {
                for (let hour = 0; hour < 24; hour++) {
                    global[day][hour] += heatmap[day][hour];
                }
            }
        });

        return global;
    }

    // ==========================================
    // Status
    // ==========================================

    getStatus(): {
        totalProfiles: number;
        highEngagement: number;
        potentialGhosting: number;
        activePredictions: number;
        recentAnomalies: number;
    } {
        const summary = this.getSummary();
        return {
            totalProfiles: summary.totalContacts,
            highEngagement: summary.highEngagement,
            potentialGhosting: summary.potentialGhosting,
            activePredictions: summary.predictions.length,
            recentAnomalies: summary.recentAnomalies.length,
        };
    }
}
