/**
 * JARVIS ULTIMATE - Profiling Service
 * 
 * Orchestrates contact profiling and behavioral analysis.
 */

import { injectable, inject } from 'tsyringe';
import { ContactProfile, ContactProfileData } from './contact-profile.entity.js';
import { EventBus } from '../../core/event-bus.js';
import { Logger } from '../../core/logger.js';
import { AIProvider, AIRequest } from '../ai/ai.types.js';

// ============================================
// Types
// ============================================

export interface MessageData {
    contactId: string;
    content: string;
    timestamp: Date;
    isFromContact: boolean;
    responseTimeMs?: number;
}

export interface ProfileInsight {
    type: 'engagement' | 'ghosting' | 'pattern' | 'sentiment' | 'timezone';
    severity: 'info' | 'warning' | 'alert';
    message: string;
    data?: Record<string, unknown>;
}

// ============================================
// In-Memory Storage (Replace with Repository)
// ============================================

const profileStorage = new Map<string, ContactProfileData>();

// ============================================
// Profiling Service
// ============================================

@injectable()
export class ProfilingService {
    constructor(
        @inject('EventBus') private eventBus: EventBus,
        @inject('Logger') private logger: Logger,
    ) {
        this.setupEventListeners();
    }

    // ==========================================
    // Core Methods
    // ==========================================

    /**
     * Get or create profile for a contact
     */
    async getProfile(contactId: string): Promise<ContactProfile> {
        const stored = profileStorage.get(contactId);

        if (stored) {
            return ContactProfile.fromJSON(stored);
        }

        // Create new profile
        const profile = new ContactProfile({ contactId });
        profileStorage.set(contactId, profile.toJSON());

        return profile;
    }

    /**
     * Save profile
     */
    async saveProfile(profile: ContactProfile): Promise<void> {
        profileStorage.set(profile.contactId, profile.toJSON());
        this.logger.debug({ contactId: profile.contactId }, 'Profile saved');
    }

    /**
     * Process a message and update profile
     */
    async processMessage(data: MessageData): Promise<ProfileInsight[]> {
        const profile = await this.getProfile(data.contactId);
        const insights: ProfileInsight[] = [];

        // Record message
        const hasEmojis = this.detectEmojis(data.content);
        profile.recordMessage(
            data.timestamp,
            data.isFromContact,
            data.content.length,
            hasEmojis
        );

        // Update response time if available
        if (data.responseTimeMs) {
            profile.updateResponseTime(data.responseTimeMs);
        }

        // Update ghosting score
        const daysSince = this.daysSinceLastInteraction(profile.engagement.lastInteraction);
        profile.updateGhostingScore(daysSince, profile.engagement.totalMessages > 10);

        // Check for insights
        if (profile.engagement.ghostingScore > 70) {
            insights.push({
                type: 'ghosting',
                severity: 'warning',
                message: `${profile.name} has a high ghosting risk (${profile.engagement.ghostingScore}%)`,
                data: { score: profile.engagement.ghostingScore },
            });
        }

        if (profile.engagement.totalMessages % 50 === 0) {
            profile.inferTimezone();
            insights.push({
                type: 'pattern',
                severity: 'info',
                message: `Activity patterns updated for ${profile.name}`,
                data: {
                    peakHours: profile.getPeakHours(),
                    activeDays: profile.getMostActiveDays(),
                },
            });
        }

        // Save updated profile
        await this.saveProfile(profile);

        return insights;
    }

    /**
     * Get insights for a contact
     */
    async getInsights(contactId: string): Promise<ProfileInsight[]> {
        const profile = await this.getProfile(contactId);
        const insights: ProfileInsight[] = [];

        // Ghosting alert
        if (profile.engagement.ghostingScore > 50) {
            insights.push({
                type: 'ghosting',
                severity: profile.engagement.ghostingScore > 70 ? 'alert' : 'warning',
                message: `Ghosting risk: ${profile.engagement.ghostingScore}%`,
                data: { score: profile.engagement.ghostingScore },
            });
        }

        // Engagement insight
        if (profile.engagement.engagementScore < 30) {
            insights.push({
                type: 'engagement',
                severity: 'warning',
                message: 'Low engagement - consider re-engaging',
                data: { score: profile.engagement.engagementScore },
            });
        }

        // Timezone insight
        if (profile.timezoneInfo.confidence > 0.7) {
            insights.push({
                type: 'timezone',
                severity: 'info',
                message: `Best contact hours: ${profile.timezoneInfo.activeHours.start}h-${profile.timezoneInfo.activeHours.end}h`,
                data: { timezone: profile.timezoneInfo },
            });
        }

        return insights;
    }

    /**
     * Get all profiles with basic stats
     */
    async getAllProfiles(): Promise<Array<{ contactId: string; name: string; engagementScore: number; ghostingScore: number }>> {
        return Array.from(profileStorage.values()).map(data => ({
            contactId: data.contactId,
            name: data.name,
            engagementScore: data.engagement.engagementScore,
            ghostingScore: data.engagement.ghostingScore,
        }));
    }

    /**
     * Analyze personality with AI
     */
    async analyzePersonality(contactId: string, aiProvider: AIProvider): Promise<string> {
        const profile = await this.getProfile(contactId);

        const request: AIRequest = {
            prompt: `
Analyze the following contact profile and provide a brief personality assessment:

${profile.getSummary()}

Provide:
1. Predicted personality type (e.g., MBTI-like)
2. Communication preferences
3. Best approach for conversations
4. Potential interests based on patterns

Keep the response concise (max 200 words).
            `.trim(),
            systemPrompt: 'You are a behavioral analyst. Provide professional, concise insights.',
            temperature: 0.7,
            maxTokens: 300,
        };

        const result = await aiProvider.generateContent(request);

        if (result.success) {
            return result.data.content;
        }

        return 'Unable to analyze personality at this time.';
    }

    // ==========================================
    // Private Methods
    // ==========================================

    private setupEventListeners(): void {
        this.eventBus.on('message:received', async (data) => {
            try {
                await this.processMessage({
                    contactId: data.contact?.id || data.message?.chatId || 'unknown',
                    content: data.message?.body || '',
                    timestamp: data.timestamp || new Date(),
                    isFromContact: true,
                });
            } catch (error) {
                this.logger.error({ error }, 'Error processing message for profiling');
            }
        });
    }

    private detectEmojis(text: string): boolean {
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
        return emojiRegex.test(text);
    }

    private daysSinceLastInteraction(lastInteraction: Date): number {
        const now = new Date();
        const diff = now.getTime() - lastInteraction.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
}
