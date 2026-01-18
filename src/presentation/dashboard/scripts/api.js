/**
 * JARVIS ULTIMATE - API Client
 * 
 * Client for communicating with the backend API.
 */

class APIError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'APIError';
    }
}

class APIClient {
    constructor(baseUrl = '/api/v1') {
        this.baseUrl = baseUrl;
    }

    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                ...options,
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new APIError(
                    data.error?.code || 'UNKNOWN_ERROR',
                    data.error?.message || 'An error occurred'
                );
            }

            return data.data;
        } catch (error) {
            if (error instanceof APIError) throw error;
            throw new APIError('NETWORK_ERROR', error.message);
        }
    }

    // =====================
    // Analytics
    // =====================

    async getDashboard() {
        return this.request('/analytics/dashboard');
    }

    async getContactAnalytics(contactId) {
        return this.request(`/analytics/contacts/${contactId}`);
    }

    async getPredictions() {
        return this.request('/analytics/predictions');
    }

    async getAnomalies() {
        return this.request('/analytics/anomalies');
    }

    // =====================
    // Forensics
    // =====================

    async getAckLogs(contactId) {
        return this.request(`/forensics/acks/${contactId || ''}`);
    }

    async getPresenceLogs(contactId) {
        return this.request(`/forensics/presence/${contactId || ''}`);
    }

    async getCallLogs(contactId) {
        return this.request(`/forensics/calls/${contactId || ''}`);
    }

    async startStalk(contactId) {
        return this.request('/forensics/stalk', {
            method: 'POST',
            body: JSON.stringify({ contactId }),
        });
    }

    async stopStalk(contactId) {
        return this.request(`/forensics/stalk/${contactId}`, {
            method: 'DELETE',
        });
    }

    // =====================
    // Messages
    // =====================

    async getMessages(chatId, options = {}) {
        const params = new URLSearchParams(options);
        return this.request(`/messages/${chatId}?${params}`);
    }

    async sendMessage(chatId, content) {
        return this.request('/messages/send', {
            method: 'POST',
            body: JSON.stringify({ chatId, content }),
        });
    }

    async searchMessages(query) {
        return this.request(`/messages/search?q=${encodeURIComponent(query)}`);
    }

    // =====================
    // Commands
    // =====================

    async getCommands() {
        return this.request('/commands/list');
    }

    async executeCommand(command, args = []) {
        return this.request('/commands/execute', {
            method: 'POST',
            body: JSON.stringify({ command, args }),
        });
    }

    // =====================
    // System
    // =====================

    async getSystemStatus() {
        return this.request('/system/status');
    }

    async getMetrics() {
        return this.request('/system/metrics');
    }

    async reloadConfig() {
        return this.request('/system/reload', { method: 'POST' });
    }

    async getLogs(limit = 100) {
        return this.request(`/system/logs?limit=${limit}`);
    }

    // =====================
    // GodMode (NOVO)
    // =====================

    async getGodModeConfig() {
        return this.request('/godmode/config');
    }

    async updateGodModeConfig(config) {
        return this.request('/godmode/config', {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async getGodModeStatus() {
        return this.request('/godmode/status');
    }

    async getDeletedMessages(limit = 50) {
        return this.request(`/godmode/deleted?limit=${limit}`);
    }

    async getViewOnceSaved(limit = 50) {
        return this.request(`/godmode/viewonce?limit=${limit}`);
    }

    async getStalkTargets() {
        return this.request('/godmode/stalking');
    }

    // =====================
    // Analytics Enhanced (NOVO)
    // =====================

    async getGhostingAlerts() {
        return this.request('/analytics/ghosting');
    }

    async getHeatmap(contactId) {
        return this.request(`/analytics/heatmap/${contactId || 'global'}`);
    }

    async getEngagementRanking() {
        return this.request('/analytics/engagement');
    }

    async getContactProfile(contactId) {
        return this.request(`/analytics/profile/${contactId}`);
    }

    // =====================
    // Forensics Enhanced (NOVO)
    // =====================

    async getTimezoneInference(contactId) {
        return this.request(`/forensics/timezone/${contactId}`);
    }

    async getDeviceChanges(contactId) {
        return this.request(`/forensics/devices/${contactId}`);
    }

    async getContactTimeline(contactId) {
        return this.request(`/forensics/timeline/${contactId}`);
    }

    async getMediaMetadata(limit = 50) {
        return this.request(`/forensics/media?limit=${limit}`);
    }
}

// Export singleton
const api = new APIClient();
