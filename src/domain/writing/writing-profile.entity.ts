/**
 * JARVIS ULTIMATE - Writing Profile Entity
 * 
 * Analyzes and stores writing patterns of a contact.
 */

// ============================================
// Types
// ============================================

export interface VocabularyStats {
    uniqueWords: number;
    averageWordLength: number;
    vocabularyRichness: number; // 0-1
    commonWords: string[];
    rareWords: string[];
}

export interface SentimentHistory {
    timestamp: Date;
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number; // -1 to 1
}

export interface WritingMetrics {
    averageMessageLength: number;
    averageSentenceLength: number;
    punctuationUsage: number; // 0-1
    capitalizationStyle: 'proper' | 'lower' | 'upper' | 'mixed';
    typoFrequency: number; // 0-1
}

export interface EmojiUsage {
    usesEmojis: boolean;
    frequency: number; // 0-1
    favorites: string[];
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

export interface ToneAnalysis {
    formality: number; // 0-1 (0 = very informal, 1 = very formal)
    friendliness: number; // 0-1
    urgency: number; // 0-1
    assertiveness: number; // 0-1
    emotionality: number; // 0-1
}

export interface WritingProfileData {
    contactId: string;
    vocabulary: VocabularyStats;
    metrics: WritingMetrics;
    emoji: EmojiUsage;
    tone: ToneAnalysis;
    sentimentHistory: SentimentHistory[];
    preferredLanguage: string;
    abbreviations: string[];
    catchphrases: string[];
    createdAt: Date;
    updatedAt: Date;
}

// ============================================
// Writing Profile Entity
// ============================================

export class WritingProfile {
    private data: WritingProfileData;
    private wordFrequency: Map<string, number> = new Map();

    constructor(data: Partial<WritingProfileData> & { contactId: string }) {
        this.data = {
            contactId: data.contactId,
            vocabulary: data.vocabulary || {
                uniqueWords: 0,
                averageWordLength: 0,
                vocabularyRichness: 0,
                commonWords: [],
                rareWords: [],
            },
            metrics: data.metrics || {
                averageMessageLength: 0,
                averageSentenceLength: 0,
                punctuationUsage: 0,
                capitalizationStyle: 'mixed',
                typoFrequency: 0,
            },
            emoji: data.emoji || {
                usesEmojis: false,
                frequency: 0,
                favorites: [],
                sentiment: 'neutral',
            },
            tone: data.tone || {
                formality: 0.5,
                friendliness: 0.5,
                urgency: 0.3,
                assertiveness: 0.5,
                emotionality: 0.5,
            },
            sentimentHistory: data.sentimentHistory || [],
            preferredLanguage: data.preferredLanguage || 'pt-BR',
            abbreviations: data.abbreviations || [],
            catchphrases: data.catchphrases || [],
            createdAt: data.createdAt || new Date(),
            updatedAt: data.updatedAt || new Date(),
        };
    }

    // ==========================================
    // Getters
    // ==========================================

    get contactId(): string { return this.data.contactId; }
    get vocabulary(): VocabularyStats { return this.data.vocabulary; }
    get metrics(): WritingMetrics { return this.data.metrics; }
    get tone(): ToneAnalysis { return this.data.tone; }
    get emoji(): EmojiUsage { return this.data.emoji; }

    // ==========================================
    // Analysis Methods
    // ==========================================

    /**
     * Analyze a message and update profile
     */
    analyzeMessage(text: string): void {
        if (!text || text.length === 0) return;

        // Update metrics
        this.updateMetrics(text);

        // Update vocabulary
        this.updateVocabulary(text);

        // Update emoji usage
        this.updateEmojiUsage(text);

        // Update tone
        this.updateTone(text);

        // Record sentiment
        this.recordSentiment(text);

        // Detect abbreviations
        this.detectAbbreviations(text);

        this.data.updatedAt = new Date();
    }

    private updateMetrics(text: string): void {
        // Message length (exponential moving average)
        this.data.metrics.averageMessageLength =
            (this.data.metrics.averageMessageLength * 0.9) + (text.length * 0.1);

        // Sentence length
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 0) {
            const avgSentenceLen = text.length / sentences.length;
            this.data.metrics.averageSentenceLength =
                (this.data.metrics.averageSentenceLength * 0.9) + (avgSentenceLen * 0.1);
        }

        // Punctuation usage
        const punctuationCount = (text.match(/[.,!?;:]/g) || []).length;
        const punctuationRatio = punctuationCount / text.length;
        this.data.metrics.punctuationUsage =
            (this.data.metrics.punctuationUsage * 0.9) + (punctuationRatio * 0.1);

        // Capitalization style
        const upperCount = (text.match(/[A-ZÀ-Ú]/g) || []).length;
        const lowerCount = (text.match(/[a-zà-ú]/g) || []).length;
        const total = upperCount + lowerCount;

        if (total > 0) {
            const upperRatio = upperCount / total;
            if (upperRatio > 0.8) {
                this.data.metrics.capitalizationStyle = 'upper';
            } else if (upperRatio < 0.1) {
                this.data.metrics.capitalizationStyle = 'lower';
            } else if (upperRatio < 0.15) {
                this.data.metrics.capitalizationStyle = 'proper';
            } else {
                this.data.metrics.capitalizationStyle = 'mixed';
            }
        }
    }

    private updateVocabulary(text: string): void {
        const words = text.toLowerCase()
            .replace(/[^\w\sáàâãéèêíìîóòôõúùûç]/gi, '')
            .split(/\s+/)
            .filter(w => w.length > 2);

        // Track word frequency
        for (const word of words) {
            const current = this.wordFrequency.get(word) || 0;
            this.wordFrequency.set(word, current + 1);
        }

        // Update vocabulary stats
        this.data.vocabulary.uniqueWords = this.wordFrequency.size;

        if (words.length > 0) {
            const avgLen = words.reduce((a, w) => a + w.length, 0) / words.length;
            this.data.vocabulary.averageWordLength =
                (this.data.vocabulary.averageWordLength * 0.9) + (avgLen * 0.1);
        }

        // Update common and rare words (periodically)
        if (this.wordFrequency.size % 50 === 0) {
            const sorted = Array.from(this.wordFrequency.entries())
                .sort((a, b) => b[1] - a[1]);

            this.data.vocabulary.commonWords = sorted.slice(0, 20).map(([word]) => word);

            // Rare = used only once, interesting words
            this.data.vocabulary.rareWords = sorted
                .filter(([, count]) => count === 1)
                .slice(0, 10)
                .map(([word]) => word);
        }
    }

    private updateEmojiUsage(text: string): void {
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        const emojis = text.match(emojiRegex) || [];

        if (emojis.length > 0) {
            this.data.emoji.usesEmojis = true;

            // Update frequency
            const emojiRatio = emojis.length / text.length;
            this.data.emoji.frequency =
                (this.data.emoji.frequency * 0.9) + (emojiRatio * 10 * 0.1);

            // Track favorites
            for (const emoji of emojis) {
                if (!this.data.emoji.favorites.includes(emoji)) {
                    this.data.emoji.favorites.push(emoji);
                    if (this.data.emoji.favorites.length > 10) {
                        this.data.emoji.favorites.shift();
                    }
                }
            }

            // Simple emoji sentiment
            const positiveEmojis = /[\u{1F600}-\u{1F60F}]|[\u{1F618}-\u{1F61C}]|[\u{2764}]|[\u{1F496}-\u{1F49F}]/gu;
            const negativeEmojis = /[\u{1F620}-\u{1F629}]|[\u{1F62D}-\u{1F62F}]|[\u{1F4A9}]/gu;

            const positiveCount = (text.match(positiveEmojis) || []).length;
            const negativeCount = (text.match(negativeEmojis) || []).length;

            if (positiveCount > negativeCount) {
                this.data.emoji.sentiment = 'positive';
            } else if (negativeCount > positiveCount) {
                this.data.emoji.sentiment = 'negative';
            } else {
                this.data.emoji.sentiment = 'neutral';
            }
        }
    }

    private updateTone(text: string): void {
        const lower = text.toLowerCase();

        // Formality indicators
        const formalWords = ['prezado', 'atenciosamente', 'senhor', 'senhora', 'cordialmente', 'conforme'];
        const informalWords = ['oi', 'ei', 'cara', 'mano', 'véi', 'blz', 'vlw', 'tmj', 'kkkk'];

        const formalCount = formalWords.filter(w => lower.includes(w)).length;
        const informalCount = informalWords.filter(w => lower.includes(w)).length;

        if (formalCount > 0 || informalCount > 0) {
            const formalRatio = formalCount / (formalCount + informalCount);
            this.data.tone.formality =
                (this.data.tone.formality * 0.8) + (formalRatio * 0.2);
        }

        // Friendliness (positive words)
        const friendlyWords = ['obrigado', 'parabéns', 'adorei', 'gostei', 'feliz', 'legal'];
        const friendlyCount = friendlyWords.filter(w => lower.includes(w)).length;
        if (friendlyCount > 0) {
            this.data.tone.friendliness = Math.min(1, this.data.tone.friendliness + 0.05);
        }

        // Urgency (exclamations, caps, urgent words)
        const urgentWords = ['urgente', 'agora', 'rápido', 'importante', 'imediatamente'];
        const urgentCount = urgentWords.filter(w => lower.includes(w)).length;
        const exclamationCount = (text.match(/!/g) || []).length;

        if (urgentCount > 0 || exclamationCount > 2) {
            this.data.tone.urgency = Math.min(1, this.data.tone.urgency + 0.1);
        } else {
            this.data.tone.urgency = Math.max(0, this.data.tone.urgency - 0.02);
        }
    }

    private recordSentiment(text: string): void {
        const lower = text.toLowerCase();

        // Simple sentiment analysis
        const positiveWords = ['bom', 'ótimo', 'legal', 'adorei', 'feliz', 'obrigado', 'parabéns', 'maravilhoso'];
        const negativeWords = ['ruim', 'péssimo', 'triste', 'raiva', 'odeio', 'terrível', 'problema'];

        const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
        const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

        let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
        let score = 0;

        if (positiveCount > negativeCount) {
            sentiment = 'positive';
            score = Math.min(1, positiveCount * 0.2);
        } else if (negativeCount > positiveCount) {
            sentiment = 'negative';
            score = -Math.min(1, negativeCount * 0.2);
        }

        this.data.sentimentHistory.push({
            timestamp: new Date(),
            sentiment,
            score,
        });

        // Keep only last 100 records
        if (this.data.sentimentHistory.length > 100) {
            this.data.sentimentHistory = this.data.sentimentHistory.slice(-100);
        }
    }

    private detectAbbreviations(text: string): void {
        // Common Portuguese abbreviations
        const abbrevPatterns = [
            /\bvc\b/gi, /\bblz\b/gi, /\bvlw\b/gi, /\btmj\b/gi,
            /\bpq\b/gi, /\btb\b/gi, /\bnd\b/gi, /\bfds\b/gi,
            /\bq\b/gi, /\bp\/\b/gi, /\bc\/\b/gi, /\bs\/\b/gi,
        ];

        for (const pattern of abbrevPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                for (const match of matches) {
                    const normalized = match.toLowerCase();
                    if (!this.data.abbreviations.includes(normalized)) {
                        this.data.abbreviations.push(normalized);
                    }
                }
            }
        }
    }

    // ==========================================
    // Get Insights
    // ==========================================

    /**
     * Get writing style summary
     */
    getStyleSummary(): string {
        const { formality, friendliness, urgency, emotionality } = this.data.tone;

        const formalityDesc = formality > 0.7 ? 'formal' : formality > 0.4 ? 'semi-formal' : 'informal';
        const friendlinessDesc = friendliness > 0.7 ? 'very friendly' : friendliness > 0.4 ? 'friendly' : 'neutral';

        let style = `${formalityDesc}, ${friendlinessDesc}`;

        if (emotionality > 0.7) style += ', expressive';
        if (urgency > 0.5) style += ', tends to be urgent';
        if (this.data.emoji.usesEmojis) style += ', uses emojis';
        if (this.data.abbreviations.length > 5) style += ', uses many abbreviations';

        return style;
    }

    /**
     * Get average sentiment
     */
    getAverageSentiment(): { sentiment: string; score: number } {
        if (this.data.sentimentHistory.length === 0) {
            return { sentiment: 'neutral', score: 0 };
        }

        const avgScore = this.data.sentimentHistory.reduce((a, b) => a + b.score, 0)
            / this.data.sentimentHistory.length;

        let sentiment = 'neutral';
        if (avgScore > 0.2) sentiment = 'positive';
        else if (avgScore < -0.2) sentiment = 'negative';

        return { sentiment, score: avgScore };
    }

    // ==========================================
    // Serialization
    // ==========================================

    toJSON(): WritingProfileData {
        return { ...this.data };
    }

    static fromJSON(data: WritingProfileData): WritingProfile {
        return new WritingProfile(data);
    }
}
