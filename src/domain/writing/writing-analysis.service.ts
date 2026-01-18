/**
 * JARVIS ULTIMATE - Writing Analysis Service
 * 
 * Analyzes writing patterns and provides insights.
 */

import { injectable, inject } from 'tsyringe';
import { WritingProfile, WritingProfileData } from './writing-profile.entity.js';
import { Logger } from '../../core/logger.js';
import { AIProvider, AIRequest } from '../ai/ai.types.js';

// ============================================
// Types
// ============================================

export interface WritingInsight {
    type: 'vocabulary' | 'tone' | 'sentiment' | 'pattern';
    title: string;
    description: string;
    confidence: number; // 0-1
}

export interface WritingComparison {
    contactA: string;
    contactB: string;
    similarity: number; // 0-1
    differences: string[];
}

// ============================================
// In-Memory Storage
// ============================================

const writingStorage = new Map<string, WritingProfileData>();

// ============================================
// Writing Analysis Service
// ============================================

@injectable()
export class WritingAnalysisService {
    constructor(
        @inject('Logger') private logger: Logger,
    ) { }

    // ==========================================
    // Core Methods
    // ==========================================

    /**
     * Get or create writing profile
     */
    async getProfile(contactId: string): Promise<WritingProfile> {
        const stored = writingStorage.get(contactId);

        if (stored) {
            return WritingProfile.fromJSON(stored);
        }

        const profile = new WritingProfile({ contactId });
        writingStorage.set(contactId, profile.toJSON());

        return profile;
    }

    /**
     * Save writing profile
     */
    async saveProfile(profile: WritingProfile): Promise<void> {
        writingStorage.set(profile.contactId, profile.toJSON());
    }

    /**
     * Analyze a message
     */
    async analyzeMessage(contactId: string, text: string): Promise<void> {
        const profile = await this.getProfile(contactId);
        profile.analyzeMessage(text);
        await this.saveProfile(profile);
    }

    /**
     * Get writing insights for a contact
     */
    async getInsights(contactId: string): Promise<WritingInsight[]> {
        const profile = await this.getProfile(contactId);
        const insights: WritingInsight[] = [];

        // Vocabulary insights
        if (profile.vocabulary.uniqueWords > 100) {
            const richness = profile.vocabulary.vocabularyRichness;
            insights.push({
                type: 'vocabulary',
                title: richness > 0.7 ? 'Rich Vocabulary' : 'Limited Vocabulary',
                description: `Uses ${profile.vocabulary.uniqueWords} unique words with ${richness > 0.7 ? 'diverse' : 'repetitive'} patterns`,
                confidence: 0.8,
            });
        }

        // Tone insights
        const tone = profile.tone;
        if (tone.formality > 0.7) {
            insights.push({
                type: 'tone',
                title: 'Formal Communicator',
                description: 'Prefers formal language and proper grammar',
                confidence: tone.formality,
            });
        } else if (tone.formality < 0.3) {
            insights.push({
                type: 'tone',
                title: 'Casual Communicator',
                description: 'Uses informal language, abbreviations, and slang',
                confidence: 1 - tone.formality,
            });
        }

        // Sentiment insights
        const sentiment = profile.getAverageSentiment();
        if (Math.abs(sentiment.score) > 0.3) {
            insights.push({
                type: 'sentiment',
                title: sentiment.score > 0 ? 'Positive Communicator' : 'Tends Negative',
                description: `Overall sentiment is ${sentiment.sentiment} (score: ${sentiment.score.toFixed(2)})`,
                confidence: Math.abs(sentiment.score),
            });
        }

        // Emoji insight
        if (profile.emoji.usesEmojis && profile.emoji.frequency > 0.3) {
            insights.push({
                type: 'pattern',
                title: 'Heavy Emoji User',
                description: `Frequently uses emojis: ${profile.emoji.favorites.slice(0, 5).join(' ')}`,
                confidence: profile.emoji.frequency,
            });
        }

        return insights;
    }

    /**
     * Compare writing styles between contacts
     */
    async compareWritingStyles(contactIdA: string, contactIdB: string): Promise<WritingComparison> {
        const profileA = await this.getProfile(contactIdA);
        const profileB = await this.getProfile(contactIdB);

        const differences: string[] = [];
        let similarityScore = 0;

        // Compare formality
        const formalityDiff = Math.abs(profileA.tone.formality - profileB.tone.formality);
        if (formalityDiff > 0.3) {
            differences.push(`${contactIdA} is more ${profileA.tone.formality > profileB.tone.formality ? 'formal' : 'informal'}`);
        } else {
            similarityScore += 0.25;
        }

        // Compare emotionality
        const emotionalityDiff = Math.abs(profileA.tone.emotionality - profileB.tone.emotionality);
        if (emotionalityDiff < 0.3) {
            similarityScore += 0.25;
        } else {
            differences.push('Different emotional expression levels');
        }

        // Compare emoji usage
        if (profileA.emoji.usesEmojis === profileB.emoji.usesEmojis) {
            similarityScore += 0.25;
        } else {
            differences.push(`${profileA.emoji.usesEmojis ? contactIdA : contactIdB} uses more emojis`);
        }

        // Compare message length
        const lengthDiff = Math.abs(profileA.metrics.averageMessageLength - profileB.metrics.averageMessageLength);
        if (lengthDiff < 50) {
            similarityScore += 0.25;
        } else {
            differences.push('Different message length tendencies');
        }

        return {
            contactA: contactIdA,
            contactB: contactIdB,
            similarity: similarityScore,
            differences,
        };
    }

    /**
     * Detect writing style changes (personality shifts)
     */
    async detectStyleChanges(contactId: string): Promise<string[]> {
        const profile = await this.getProfile(contactId);
        const changes: string[] = [];

        // Check sentiment history for shifts
        const history = profile.toJSON().sentimentHistory;
        if (history.length > 20) {
            const recent = history.slice(-10);
            const older = history.slice(-20, -10);

            const recentAvg = recent.reduce((a, b) => a + b.score, 0) / recent.length;
            const olderAvg = older.reduce((a, b) => a + b.score, 0) / older.length;

            if (recentAvg - olderAvg > 0.3) {
                changes.push('Sentiment has become more positive recently');
            } else if (olderAvg - recentAvg > 0.3) {
                changes.push('Sentiment has become more negative recently');
            }
        }

        return changes;
    }

    /**
     * Generate AI-powered writing analysis
     */
    async generateAIAnalysis(contactId: string, aiProvider: AIProvider): Promise<string> {
        const profile = await this.getProfile(contactId);
        const style = profile.getStyleSummary();
        const sentiment = profile.getAverageSentiment();

        const request: AIRequest = {
            prompt: `
Analyze this writing profile and provide insights:

Writing Style: ${style}
Average Sentiment: ${sentiment.sentiment} (${sentiment.score.toFixed(2)})
Vocabulary Size: ${profile.vocabulary.uniqueWords} unique words
Common Words: ${profile.vocabulary.commonWords.slice(0, 10).join(', ')}
Uses Emojis: ${profile.emoji.usesEmojis ? `Yes, favorites: ${profile.emoji.favorites.join('')}` : 'No'}
Abbreviations: ${profile.toJSON().abbreviations.join(', ') || 'None detected'}
Formality Score: ${(profile.tone.formality * 100).toFixed(0)}%
Friendliness Score: ${(profile.tone.friendliness * 100).toFixed(0)}%

Provide:
1. Personality assessment based on writing
2. Communication recommendations
3. Topics they might be interested in
4. How to best engage with them

Keep response under 250 words.
            `.trim(),
            systemPrompt: 'You are a linguistic analyst. Be concise and insightful.',
            temperature: 0.7,
            maxTokens: 400,
        };

        const result = await aiProvider.generateContent(request);

        if (result.success) {
            return result.data.content;
        }

        return 'Unable to generate analysis at this time.';
    }
}
