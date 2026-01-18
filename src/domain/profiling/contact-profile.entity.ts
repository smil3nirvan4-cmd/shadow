/**
 * JARVIS ULTIMATE - Contact Profile Entity
 * 
 * Complete behavioral profile of a contact.
 */

// ============================================
// Types
// ============================================

export interface ActivityPattern {
    hour: number; // 0-23
    dayOfWeek: number; // 0-6 (Sunday-Saturday)
    count: number;
}

export interface DeviceFingerprint {
    platform: string; // iOS, Android, Web
    deviceId?: string;
    version?: string;
    lastSeen: Date;
}

export interface CommunicationStyle {
    formality: 'formal' | 'informal' | 'mixed';
    averageMessageLength: number;
    usesEmojis: boolean;
    emojiFrequency: number; // 0-1
    usesAbbreviations: boolean;
    preferredLanguage: string;
    responseSpeed: 'fast' | 'moderate' | 'slow' | 'variable';
}

export interface EngagementMetrics {
    totalMessages: number;
    totalCalls: number;
    averageResponseTimeMs: number;
    ghostingScore: number; // 0-100, higher = more likely to ghost
    engagementScore: number; // 0-100
    lastInteraction: Date;
    interactionFrequency: 'daily' | 'weekly' | 'monthly' | 'rare';
}

export interface TimezoneInfo {
    inferred: string; // e.g., "America/Sao_Paulo"
    confidence: number; // 0-1
    activeHours: { start: number; end: number }; // 0-23
}

export interface ContactProfileData {
    contactId: string;
    name: string;
    phoneNumber: string;
    profilePic?: string;

    // Behavioral data
    activityPatterns: ActivityPattern[];
    communicationStyle: CommunicationStyle;
    engagement: EngagementMetrics;
    timezoneInfo: TimezoneInfo;
    deviceFingerprints: DeviceFingerprint[];

    // Relationship data
    relationship?: string;
    interests: string[];
    frequentTopics: string[];
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';

    // Metadata
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// Contact Profile Entity
// ============================================

export class ContactProfile {
    private data: ContactProfileData;

    constructor(data: Partial<ContactProfileData> & { contactId: string }) {
        this.data = {
            contactId: data.contactId,
            name: data.name || 'Unknown',
            phoneNumber: data.phoneNumber || data.contactId.split('@')[0],
            profilePic: data.profilePic,

            activityPatterns: data.activityPatterns || [],
            communicationStyle: data.communicationStyle || {
                formality: 'mixed',
                averageMessageLength: 0,
                usesEmojis: false,
                emojiFrequency: 0,
                usesAbbreviations: false,
                preferredLanguage: 'pt-BR',
                responseSpeed: 'moderate',
            },
            engagement: data.engagement || {
                totalMessages: 0,
                totalCalls: 0,
                averageResponseTimeMs: 0,
                ghostingScore: 0,
                engagementScore: 0,
                lastInteraction: new Date(),
                interactionFrequency: 'rare',
            },
            timezoneInfo: data.timezoneInfo || {
                inferred: 'America/Sao_Paulo',
                confidence: 0.5,
                activeHours: { start: 9, end: 22 },
            },
            deviceFingerprints: data.deviceFingerprints || [],

            relationship: data.relationship,
            interests: data.interests || [],
            frequentTopics: data.frequentTopics || [],
            sentiment: data.sentiment || 'neutral',

            createdAt: data.createdAt || new Date(),
            updatedAt: data.updatedAt || new Date(),
        };
    }

    // ==========================================
    // Getters
    // ==========================================

    get contactId(): string { return this.data.contactId; }
    get name(): string { return this.data.name; }
    get phoneNumber(): string { return this.data.phoneNumber; }
    get engagement(): EngagementMetrics { return this.data.engagement; }
    get communicationStyle(): CommunicationStyle { return this.data.communicationStyle; }
    get timezoneInfo(): TimezoneInfo { return this.data.timezoneInfo; }
    get sentiment(): string { return this.data.sentiment; }

    // ==========================================
    // Activity Pattern Analysis
    // ==========================================

    /**
     * Get peak activity hours
     */
    getPeakHours(): number[] {
        const hourCounts = new Map<number, number>();

        for (const pattern of this.data.activityPatterns) {
            const current = hourCounts.get(pattern.hour) || 0;
            hourCounts.set(pattern.hour, current + pattern.count);
        }

        // Sort by count and get top 3
        return Array.from(hourCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hour]) => hour);
    }

    /**
     * Get most active days
     */
    getMostActiveDays(): string[] {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayCounts = new Map<number, number>();

        for (const pattern of this.data.activityPatterns) {
            const current = dayCounts.get(pattern.dayOfWeek) || 0;
            dayCounts.set(pattern.dayOfWeek, current + pattern.count);
        }

        return Array.from(dayCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([day]) => dayNames[day]);
    }

    /**
     * Generate 7x24 heatmap data
     */
    getActivityHeatmap(): number[][] {
        const heatmap: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

        for (const pattern of this.data.activityPatterns) {
            heatmap[pattern.dayOfWeek][pattern.hour] += pattern.count;
        }

        // Normalize to 0-10
        const max = Math.max(...heatmap.flat());
        if (max > 0) {
            for (let d = 0; d < 7; d++) {
                for (let h = 0; h < 24; h++) {
                    heatmap[d][h] = Math.round((heatmap[d][h] / max) * 10);
                }
            }
        }

        return heatmap;
    }

    // ==========================================
    // Update Methods
    // ==========================================

    /**
     * Record a message interaction
     */
    recordMessage(timestamp: Date, isFromContact: boolean, messageLength: number, hasEmojis: boolean): void {
        const hour = timestamp.getHours();
        const dayOfWeek = timestamp.getDay();

        // Update activity pattern
        const existing = this.data.activityPatterns.find(
            p => p.hour === hour && p.dayOfWeek === dayOfWeek
        );

        if (existing) {
            existing.count++;
        } else {
            this.data.activityPatterns.push({ hour, dayOfWeek, count: 1 });
        }

        // Update engagement
        this.data.engagement.totalMessages++;
        this.data.engagement.lastInteraction = timestamp;

        // Update communication style
        const style = this.data.communicationStyle;
        style.averageMessageLength = (style.averageMessageLength * 0.9) + (messageLength * 0.1);

        if (hasEmojis) {
            style.usesEmojis = true;
            style.emojiFrequency = Math.min(1, style.emojiFrequency + 0.05);
        }

        this.data.updatedAt = new Date();
    }

    /**
     * Update response time metrics
     */
    updateResponseTime(responseTimeMs: number): void {
        const currentAvg = this.data.engagement.averageResponseTimeMs;
        this.data.engagement.averageResponseTimeMs = (currentAvg * 0.8) + (responseTimeMs * 0.2);

        // Update response speed classification
        const style = this.data.communicationStyle;
        if (responseTimeMs < 60000) { // < 1 min
            style.responseSpeed = 'fast';
        } else if (responseTimeMs < 300000) { // < 5 min
            style.responseSpeed = 'moderate';
        } else if (responseTimeMs < 3600000) { // < 1 hour
            style.responseSpeed = 'slow';
        } else {
            style.responseSpeed = 'variable';
        }

        this.data.updatedAt = new Date();
    }

    /**
     * Update ghosting score
     */
    updateGhostingScore(daysSinceContact: number, previouslyActive: boolean): void {
        let score = this.data.engagement.ghostingScore;

        if (daysSinceContact > 7 && previouslyActive) {
            score = Math.min(100, score + 10);
        } else if (daysSinceContact <= 1) {
            score = Math.max(0, score - 5);
        }

        this.data.engagement.ghostingScore = score;
        this.data.updatedAt = new Date();
    }

    /**
     * Add device fingerprint
     */
    addDeviceFingerprint(fingerprint: Omit<DeviceFingerprint, 'lastSeen'>): void {
        const existing = this.data.deviceFingerprints.find(
            d => d.platform === fingerprint.platform && d.deviceId === fingerprint.deviceId
        );

        if (existing) {
            existing.lastSeen = new Date();
            if (fingerprint.version) existing.version = fingerprint.version;
        } else {
            this.data.deviceFingerprints.push({
                ...fingerprint,
                lastSeen: new Date(),
            });
        }

        this.data.updatedAt = new Date();
    }

    /**
     * Infer timezone from activity patterns
     */
    inferTimezone(): void {
        const peakHours = this.getPeakHours();

        if (peakHours.length === 0) return;

        // Assume peak activity is during waking hours (9-22)
        // This is a simplified inference
        const avgPeak = peakHours.reduce((a, b) => a + b, 0) / peakHours.length;

        // Simple heuristic: if peak is 9-17, likely same timezone
        // Adjust based on deviation from expected
        const expectedPeak = 14; // 2 PM
        const deviation = avgPeak - expectedPeak;

        // Map deviation to timezone offset (simplified)
        let timezone = 'America/Sao_Paulo'; // Default Brazil
        if (Math.abs(deviation) > 6) {
            timezone = 'Europe/London';
        }

        this.data.timezoneInfo = {
            inferred: timezone,
            confidence: Math.max(0.3, 1 - Math.abs(deviation) / 12),
            activeHours: {
                start: Math.min(...peakHours) - 2,
                end: Math.max(...peakHours) + 2,
            },
        };

        this.data.updatedAt = new Date();
    }

    // ==========================================
    // Serialization
    // ==========================================

    toJSON(): ContactProfileData {
        return { ...this.data };
    }

    static fromJSON(data: ContactProfileData): ContactProfile {
        return new ContactProfile(data);
    }

    /**
     * Get summary for AI analysis
     */
    getSummary(): string {
        return `
Contact: ${this.data.name} (${this.data.phoneNumber})
Communication Style: ${this.data.communicationStyle.formality}, ${this.data.communicationStyle.responseSpeed} responder
Engagement Score: ${this.data.engagement.engagementScore}/100
Ghosting Risk: ${this.data.engagement.ghostingScore}/100
Active Hours: ${this.data.timezoneInfo.activeHours.start}h-${this.data.timezoneInfo.activeHours.end}h
Last Interaction: ${this.data.engagement.lastInteraction.toISOString()}
Sentiment: ${this.data.sentiment}
Topics: ${this.data.frequentTopics.join(', ') || 'Unknown'}
        `.trim();
    }
}
