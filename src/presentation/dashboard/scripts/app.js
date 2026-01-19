/**
 * JARVIS ULTIMATE - Dashboard Application v2.0
 * 
 * Redesigned based on reference images with:
 * - Heatmap 7x24
 * - Toggle switches
 * - Engagement bars
 * - Timeline
 * - Feature cards
 */

// =============================================
// API Client (inline)
// =============================================

class APIClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        console.error(`[API Error] ${endpoint}:`, data.error?.message || 'Request failed');
        // Return mock data only if API returns error, but log it
        const mockData = this.getMockData(endpoint);
        if (mockData) {
          console.warn(`[API] Using fallback data for ${endpoint}`);
          return mockData;
        }
        throw new Error(data.error?.message || 'Request failed');
      }
      return data.data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error.message);
      // Return mock data for demo with warning
      const mockData = this.getMockData(endpoint);
      if (mockData) {
        console.warn(`[API] Using fallback data for ${endpoint} due to:`, error.message);
        return mockData;
      }
      throw error;
    }
  }

  getMockData(endpoint) {
    // EMPTY FALLBACK DATA - Only shows real data from API
    // Returns empty structures so UI remains functional but without fake data
    const emptyFallbacks = {
      '/analytics/dashboard': {
        overview: { totalMessages: 0, totalContacts: 0, totalCalls: 0, uptime: 0 },
        systemHealth: { whatsapp: 'unknown', aiProvider: 'unknown', storage: 'unknown', database: 'unknown' },
        recentActivity: []
      },
      '/analytics/predictions': [],
      '/analytics/ghosting': [],
      '/analytics/engagement': [],
      '/godmode/status': {
        config: {
          ghostMode: false,
          viewOnceBypass: false,
          antiDelete: false,
          ackSpy: false,
          presenceSpy: false,
          reactionSpy: false,
          autoRejectCalls: false,
          locationSpoofing: false,
        },
        stats: { deletedMessages: 0, viewOnceMedia: 0, stalkTargets: 0, ackLogs: 0 }
      },
      '/godmode/deleted': [],
      '/godmode/viewonce': [],
      '/forensics/timeline': [],
    };

    for (const [key, value] of Object.entries(emptyFallbacks)) {
      if (endpoint.includes(key.replace('/analytics', '').replace('/godmode', '').replace('/forensics', ''))) {
        return value;
      }
    }
    return emptyFallbacks['/analytics/dashboard'];
  }

  async getDashboard() { return this.request('/analytics/dashboard'); }
  async getPredictions() { return this.request('/analytics/predictions'); }
  async getGhostingAlerts() { return this.request('/analytics/ghosting'); }
  async getEngagementRanking() { return this.request('/analytics/engagement'); }
  async getGodModeStatus() { return this.request('/godmode/status'); }
  async getDeletedMessages() { return this.request('/godmode/deleted'); }
  async getViewOnceSaved() { return this.request('/godmode/viewonce'); }
  async getContactTimeline() { return this.request('/forensics/timeline'); }
  async getSystemStatus() { return this.request('/system/status'); }
  async updateGodModeConfig(config) { return this.request('/godmode/config', { method: 'POST', body: JSON.stringify(config) }); }

  // WhatsApp Connection APIs
  async getWhatsAppStatus() { return this.request('/whatsapp/status'); }
  async getWhatsAppQRCode() { return this.request('/whatsapp/qrcode'); }
  async connectWhatsApp() { return this.request('/whatsapp/connect', { method: 'POST' }); }
  async disconnectWhatsApp() { return this.request('/whatsapp/disconnect', { method: 'POST' }); }
  async getContacts() { return this.request('/contacts'); }
  async getChats() { return this.request('/chats'); }
  async getChatMessages(chatId, limit = 50) { return this.request(`/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`); }
  async sendMessage(chatId, message) {
    return this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ chatId, message })
    });
  }

  // Forensics APIs
  async getForensicsOverview() { return this.request('/forensics/overview'); }
  async getForensicsProtocol() { return this.request('/forensics/protocol'); }
  async getForensicsPresence(limit = 100) { return this.request(`/forensics/presence?limit=${limit}`); }
  async getForensicsCalls(limit = 100) { return this.request(`/forensics/calls?limit=${limit}`); }
  async getForensicsAcks(limit = 100) { return this.request(`/forensics/acks?limit=${limit}`); }
  async getForensicsViewOnce() { return this.request('/forensics/viewonce'); }
  async getForensicsAnomalies() { return this.request('/forensics/anomalies'); }
  async toggleForensicsCapture(action) { return this.request('/forensics/capture', { method: 'POST', body: JSON.stringify({ action }) }); }
}

const api = new APIClient();

// =============================================
// Utility Functions
// =============================================

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return 'agora';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
  return `${Math.floor(seconds / 86400)}d atrás`;
}

// =============================================
// Component Renderers
// =============================================

function renderKpiCard(icon, value, label, trend = '', trendDir = '') {
  return `
    <div class="kpi-card">
      <div class="kpi-card__header">
        <span class="kpi-card__icon">${icon}</span>
        ${trend ? `<span class="kpi-card__trend ${trendDir}">${trend}</span>` : ''}
      </div>
      <div class="kpi-card__value">${value}</div>
      <div class="kpi-card__label">${label}</div>
    </div>
  `;
}

function renderSectionHeader(icon, title) {
  return `
    <div class="section-header">
      <div class="section-header__icon">${icon}</div>
      <span class="section-header__title">${title}</span>
      <div class="section-header__line"></div>
    </div>
  `;
}

function renderToggleRow(icon, title, desc, key, isOn) {
  return `
    <div class="toggle-row">
      <div class="toggle-row__info">
        <span class="toggle-row__icon">${icon}</span>
        <div class="toggle-row__text">
          <div class="toggle-row__title">${title}</div>
          <div class="toggle-row__desc">${desc}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="toggle-status ${isOn ? 'on' : 'off'}">${isOn ? 'ON' : 'OFF'}</span>
        <label class="toggle-switch">
          <input type="checkbox" ${isOn ? 'checked' : ''} onchange="toggleGodMode('${key}', this.checked)">
          <span class="toggle-switch__slider"></span>
        </label>
      </div>
    </div>
  `;
}

function renderFeatureCard(icon, title, desc) {
  return `
    <div class="feature-card">
      <div class="feature-card__icon">${icon}</div>
      <div class="feature-card__title">${title}</div>
      <div class="feature-card__desc">${desc}</div>
    </div>
  `;
}

function renderHeatmap() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // No random data - show empty cells until real data is available
  const generateLevel = () => 0;

  return `
    <div class="heatmap">
      <div class="heatmap__title">📊 Activity Heatmap (7x24)</div>
      <div class="heatmap__grid">
        ${days.map(day => `
          <div class="heatmap__row">
            <div class="heatmap__label">${day}</div>
            <div class="heatmap__cells">
              ${hours.map(() => `<div class="heatmap__cell" data-level="${generateLevel()}"></div>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="heatmap__hours">
        ${[0, 3, 6, 9, 12, 15, 18, 21].map(h => `<div class="heatmap__hour" style="flex: 3;">${h}</div>`).join('')}
      </div>
    </div>
  `;
}

function renderEngagementList(contacts) {
  return `
    <div class="engagement-list">
      <div class="card__header">
        <h3 class="card__title">🏆 Top Engagement</h3>
      </div>
      ${contacts.map((c, i) => `
        <div class="engagement-item">
          <div class="engagement-item__rank">${i + 1}</div>
          <div class="engagement-item__info">
            <div class="engagement-item__name">${c.contactId} <span class="text-muted">(${c.msgs} msgs)</span></div>
            <div class="engagement-item__bar-container">
              <div class="engagement-item__bar" style="width: ${c.score}%;"></div>
            </div>
          </div>
          <div class="engagement-item__score">${c.score}%</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderAlertCard(icon, title, value, desc) {
  return `
    <div class="alert-card">
      <div class="alert-card__icon">${icon}</div>
      <div class="alert-card__content">
        <div class="alert-card__title">${title}</div>
        <div class="alert-card__value">${value}</div>
        <div class="alert-card__desc">${desc}</div>
      </div>
    </div>
  `;
}

function renderTimeline(events) {
  return `
    <div class="timeline">
      ${events.map(e => `
        <div class="timeline__item">
          <div class="timeline__time">${e.time}</div>
          <div class="timeline__content">
            <div class="timeline__type">${e.type}</div>
            <div class="timeline__text ${e.recovered ? 'deleted' : ''}">${e.text}${e.recovered ? ' <span class="badge badge--danger">RECOVERED BY ANTI-DELETE</span>' : ''}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStatusGrid(health) {
  return `
    <div class="status-grid">
      <div class="status-item">
        <span class="status-item__label">WhatsApp Status:</span>
        <span class="status-item__value ${health.whatsapp || 'disconnected'}">${(health.whatsapp || 'disconnected').toUpperCase()}</span>
      </div>
      <div class="status-item">
        <span class="status-item__label">AI Provider:</span>
        <span class="status-item__value ${health.aiProvider || 'ready'}">${(health.aiProvider || 'ready').toUpperCase()}</span>
      </div>
      <div class="status-item">
        <span class="status-item__label">Storage:</span>
        <span class="status-item__value ${health.storage || 'healthy'}">${(health.storage || 'healthy').toUpperCase()}</span>
      </div>
      <div class="status-item">
        <span class="status-item__label">Database:</span>
        <span class="status-item__value ${health.database || 'optimized'}">${(health.database || 'optimized').toUpperCase()}</span>
      </div>
    </div>
  `;
}

// =============================================
// Pages
// =============================================

const pages = {
  // Overview - All Features (Like Reference Image 1)
  async overview() {
    const [dashboard, godmode, predictions, engagement] = await Promise.all([
      (await api.getDashboard()) || {},
      (await api.getGodModeStatus()) || {},
      (await api.getPredictions()) || [],
      (await api.getEngagementRanking()) || [],
    ]);

    const config = godmode.config || {};
    const stats = godmode.stats || {};
    const overview = dashboard.overview || {};

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">Overview - Advanced Forensics & Behavioral Analytics</h1>
        </div>

        <!-- KEY METRICS -->
        ${renderSectionHeader('📊', 'KEY METRICS')}
        <div class="kpi-grid mb-lg">
          ${renderKpiCard('💬', overview.totalMessages?.toLocaleString() || '0', 'Total Messages', '+12%', 'up')}
          ${renderKpiCard('👥', overview.totalContacts?.toLocaleString() || '0', 'Active Contacts', '+5%', 'up')}
          ${renderKpiCard('📞', overview.totalCalls || '0', 'Recent Calls', '-8%', 'down')}
          ${renderKpiCard('⏱️', formatUptime(overview.uptime || 0), 'System Uptime', 'Stable', 'stable')}
        </div>

        <!-- GOD MODE -->
        ${renderSectionHeader('🥷', 'GOD MODE - FUNCIONALIDADES FORENSES AVANÇADAS')}
        <div class="grid grid--3 mb-lg">
          ${renderFeatureCard('👻', 'Ghost Mode', 'Não envia confirmação de leitura')}
          ${renderFeatureCard('👁️', 'ViewOnce Bypass', 'Salva mídia de visualização única')}
          ${renderFeatureCard('🗑️', 'Anti-Delete', 'Captura mensagens deletadas')}
          ${renderFeatureCard('📵', 'Auto Reject Calls', 'Rejeita chamadas automaticamente')}
          ${renderFeatureCard('✓✓', 'ACK Spy', 'Log de confirmações de leitura')}
          ${renderFeatureCard('😂', 'Reaction Spy', 'Log de reações em mensagens')}
          ${renderFeatureCard('📡', 'Presence Spy', 'Monitora presença online')}
          ${renderFeatureCard('📍', 'Location Spoofing', 'Falseia localização no dispositivo')}
          ${renderFeatureCard('📂', 'Metadata Inject', 'Insere metadados em arquivos')}
        </div>

        <!-- BEHAVIORAL ANALYTICS -->
        ${renderSectionHeader('📈', 'BEHAVIORAL ANALYTICS - ANÁLISE COMPORTAMENTAL')}
        <div class="grid grid--2 mb-lg">
          ${renderHeatmap()}
          <div>
            <div class="card mb-md">
              <div class="card__title mb-sm">⏱️ Response Time</div>
              <div style="display: flex; align-items: baseline; gap: 8px;">
                <span style="font-size: 2rem; font-weight: 700; color: var(--accent-primary); font-family: var(--font-mono);">1.2s</span>
                <span class="text-muted">Latência Média</span>
              </div>
            </div>
            ${renderEngagementList(engagement.slice(0, 3))}
          </div>
        </div>

        <!-- FORENSICS ENHANCED -->
        ${renderSectionHeader('🔍', 'FORENSICS ENHANCED - ANÁLISE FORENSE')}
        <div class="grid grid--4 mb-lg">
          ${renderFeatureCard('🌍', 'Timezone Inference', 'Localização e Fuso Horário inferido')}
          ${renderFeatureCard('📱', 'Device Fingerprint', 'Identificação Única de dispositivo')}
          ${renderFeatureCard('🖼️', 'Media Metadata', 'Extração de EXIF, GPS, dimensões')}
          ${renderFeatureCard('📅', 'Contact Timeline', 'Histórico completo de interações')}
        </div>

        <!-- SYSTEM STATUS -->
        ${renderSectionHeader('🏥', 'SYSTEM STATUS - SAÚDE E CONECTIVIDADE')}
        ${renderStatusGrid(dashboard.systemHealth || {})}
      </div>
    `;
  },

  // Dashboard
  async dashboard() {
    const dashboard = (await api.getDashboard()) || {};
    const overview = dashboard.overview || {};

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">📊 Dashboard</h1>
          <p class="page__subtitle">Visão geral do sistema JARVIS ULTIMATE</p>
        </div>

        <div class="kpi-grid mb-lg">
          ${renderKpiCard('💬', overview.totalMessages?.toLocaleString() || '0', 'Messages', '+12%', 'up')}
          ${renderKpiCard('👥', overview.totalContacts?.toLocaleString() || '0', 'Contacts', '+5%', 'up')}
          ${renderKpiCard('📞', overview.totalCalls || '0', 'Calls', '', '')}
          ${renderKpiCard('⏱️', formatUptime(overview.uptime || 0), 'Uptime', '', '')}
        </div>

        <div class="grid grid--2">
          <div class="card">
            <div class="card__header">
              <h3 class="card__title">📋 Recent Activity</h3>
            </div>
            <div class="card__content">
              ${(dashboard.recentActivity || []).map(a => `
                <div style="padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                  <span class="text-muted font-mono" style="font-size: 11px;">${timeAgo(a.time)}</span>
                  <p style="font-size: 13px;" class="${a.type}">${a.text}</p>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card__header">
              <h3 class="card__title">🏥 System Health</h3>
            </div>
            <div class="card__content">
              ${renderStatusGrid(dashboard.systemHealth || {})}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Forensics (Like Reference Image 3)
  async forensics() {
    const godmode = (await api.getGodModeStatus()) || {};
    const timeline = (await api.getContactTimeline()) || [];
    const config = godmode.config || {};

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">Forensics & God Mode Control</h1>
          <p class="page__subtitle">Advanced forensics and behavioral analytics dashboard for JARVIS ULTIMATE.</p>
        </div>

        <!-- Feature Cards -->
        <div class="feature-grid mb-lg">
          ${renderFeatureCard('📱', 'Device Fingerprint', 'Detect device changes and anomalies.')}
          ${renderFeatureCard('🖼️', 'Media Metadata Extraction', 'Extract EXIF, GPS, and dimensions.')}
          ${renderFeatureCard('📅', 'Contact Timeline', 'Full interaction history with timestamps.')}
        </div>

        <!-- God Mode Configuration -->
        ${renderSectionHeader('⚙️', 'God Mode - Advanced Monitoring Configuration')}
        <div class="grid grid--2 mb-lg">
          <div>
            ${renderToggleRow('✓✓', 'ACK Spy', 'Log delivery confirmations.', 'ackSpy', config.ackSpy)}
            ${renderToggleRow('👁️', 'ViewOnce Bypass', 'Save single-view media.', 'viewOnceBypass', config.viewOnceBypass)}
            ${renderToggleRow('👻', 'Ghost Mode', 'Hide read receipts.', 'ghostMode', config.ghostMode)}
          </div>
          <div>
            ${renderToggleRow('📡', 'Presence Spy', 'Monitor online status in real-time.', 'presenceSpy', config.presenceSpy)}
            ${renderToggleRow('🗑️', 'Anti-Delete', 'Capture deleted messages.', 'antiDelete', config.antiDelete)}
            ${renderToggleRow('😂', 'Reaction Spy', 'Log reactions to messages.', 'reactionSpy', config.reactionSpy)}
          </div>
        </div>

        <!-- Timeline -->
        ${renderSectionHeader('📅', 'Contact Timeline')}
        ${renderTimeline(timeline)}
      </div>
    `;
  },

  // Analytics (Like Reference Image 2)
  async analytics() {
    const [predictions, ghosting, engagement] = await Promise.all([
      (await api.getPredictions()) || [],
      (await api.getGhostingAlerts()) || [],
      (await api.getEngagementRanking()) || [],
    ]);

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">JARVIS Behavioral Analytics View</h1>
        </div>

        <!-- Alert Cards -->
        <div class="grid grid--2 mb-lg">
          ${renderAlertCard('👻', 'Ghosting Alerts', `${ghosting.length} Alerts Today`, 'High risk contacts not responding.')}
          ${renderAlertCard('🤖', 'Contact Predictions', `${predictions.length} AI Predictions`, 'Potential conflicts predicted based on recent patterns.')}
        </div>

        <!-- Heatmap -->
        <div class="mb-lg">
          ${renderHeatmap()}
        </div>

        <!-- Engagement -->
        ${renderEngagementList(engagement)}
      </div>
    `;
  },

  // God Mode (Full Config with Tutorials)
  async godmode() {
    const godmode = (await api.getGodModeStatus()) || {};
    const config = godmode.config || {};
    const stats = godmode.stats || {};

    const features = [
      {
        key: 'ghostMode',
        icon: '👻',
        title: 'Ghost Mode',
        desc: 'Não envia confirmação de leitura',
        tutorial: 'Quando ativado, suas mensagens lidas não mostrarão o double check azul. Os contatos não saberão que você leu.',
        stats: 'Mensagens lidas sem notificar: ' + (stats.ghostReadCount || 0),
        risk: 'low',
      },
      {
        key: 'viewOnceBypass',
        icon: '👁️',
        title: 'ViewOnce Bypass',
        desc: 'Salva mídia de visualização única',
        tutorial: 'Captura automaticamente fotos e vídeos de "visualização única" antes que desapareçam. Arquivos salvos em /saved_media.',
        stats: 'Mídia capturada: ' + (stats.viewOnceMedia || 0),
        risk: 'high',
      },
      {
        key: 'antiDelete',
        icon: '🗑️',
        title: 'Anti-Delete',
        desc: 'Captura mensagens deletadas',
        tutorial: 'Intercepta mensagens antes de serem deletadas pelo remetente ("Apagar para Todos"). Recupera texto e mídia.',
        stats: 'Mensagens recuperadas: ' + (stats.deletedMessages || 0),
        risk: 'high',
      },
      {
        key: 'autoRejectCalls',
        icon: '📵',
        title: 'Auto Reject Calls',
        desc: 'Rejeita chamadas automaticamente',
        tutorial: 'Rejeita todas as chamadas de voz e vídeo automaticamente. Útil para evitar interrupções.',
        stats: 'Chamadas rejeitadas: ' + (stats.rejectedCalls || 0),
        risk: 'low',
      },
      {
        key: 'ackSpy',
        icon: '✓✓',
        title: 'ACK Spy',
        desc: 'Log de confirmações de leitura',
        tutorial: 'Registra exatamente quando cada contato leu suas mensagens (com timestamp de milissegundos).',
        stats: 'ACKs logados: ' + (stats.ackLogs || 0),
        risk: 'medium',
      },
      {
        key: 'reactionSpy',
        icon: '😂',
        title: 'Reaction Spy',
        desc: 'Log de reações em mensagens',
        tutorial: 'Monitora todas as reações (emojis) adicionadas às suas mensagens, incluindo reações removidas.',
        stats: 'Reações capturadas: ' + (stats.reactionLogs || 0),
        risk: 'low',
      },
      {
        key: 'presenceSpy',
        icon: '📡',
        title: 'Presence Spy',
        desc: 'Monitora presença online',
        tutorial: 'Rastreia quando contatos ficam online/offline, quanto tempo permanecem online, e padrões de atividade.',
        stats: 'Eventos de presença: ' + (stats.presenceLogs || 0),
        risk: 'medium',
      },
      {
        key: 'locationSpoofing',
        icon: '📍',
        title: 'Location Spoofing',
        desc: 'Falseia localização no dispositivo',
        tutorial: 'Permite enviar localizações falsas. Configure coordenadas personalizadas antes de compartilhar localização.',
        stats: 'Localizações falsas enviadas: ' + (stats.fakeLocations || 0),
        risk: 'medium',
      },
      {
        key: 'metadataInject',
        icon: '📂',
        title: 'Metadata Inject',
        desc: 'Insere metadados em arquivos',
        tutorial: 'Permite modificar metadados EXIF de imagens (data, GPS, câmera) antes de enviar.',
        stats: 'Arquivos modificados: ' + (stats.metadataModified || 0),
        risk: 'high',
      },
    ];

    const riskColors = { low: 'success', medium: 'warning', high: 'danger' };

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">🥷 God Mode - Funcionalidades Forenses Avançadas</h1>
          <p class="page__subtitle">Configure cada funcionalidade individualmente. Clique no card para ver detalhes.</p>
        </div>

        <!-- Overview Stats -->
        <div class="kpi-grid mb-lg">
          ${renderKpiCard('🗑️', stats.deletedMessages || 0, 'Mensagens Recuperadas', '', '')}
          ${renderKpiCard('👁️', stats.viewOnceMedia || 0, 'ViewOnce Salvos', '', '')}
          ${renderKpiCard('📡', stats.presenceLogs || 0, 'Eventos Presença', '', '')}
          ${renderKpiCard('✓✓', stats.ackLogs || 0, 'ACKs Capturados', '', '')}
        </div>

        <!-- Feature Cards Grid -->
        <div class="grid grid--2 gap-lg">
          ${features.map(f => `
            <div class="card feature-detail-card" style="border-left: 4px solid var(--${riskColors[f.risk]});">
              <div class="card__header">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 32px;">${f.icon}</span>
                  <div>
                    <h3 class="card__title" style="margin: 0;">${f.title}</h3>
                    <span class="text-muted">${f.desc}</span>
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" ${config[f.key] ? 'checked' : ''} onchange="toggleGodMode('${f.key}', this.checked)">
                  <span class="toggle-switch__slider"></span>
                </label>
              </div>
              <div class="card__content">
                <div class="tutorial-box" style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); margin-bottom: 12px;">
                  <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <span>📖</span>
                    <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">${f.tutorial}</p>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="badge badge--${riskColors[f.risk]}">${f.risk.toUpperCase()} RISK</span>
                  <span class="text-muted font-mono text-xs">${f.stats}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Warning -->
        <div class="card mt-lg" style="border-color: var(--warning);">
          <div class="card__content" style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 32px;">⚠️</span>
            <div>
              <h4 style="margin: 0 0 4px;">Aviso de Responsabilidade</h4>
              <p class="text-muted" style="margin: 0;">Use estas funcionalidades com responsabilidade. Algumas podem violar os termos de serviço do WhatsApp e leis de privacidade locais.</p>
            </div>
          </div>
        </div>
    `;
  },

  // Behavioral Analytics Page
  async behavioral() {
    const predictions = (await api.getPredictions()) || [];
    const ghosting = (await api.getGhostingAlerts()) || [];
    const engagement = (await api.getEngagementRanking()) || [];

    const behaviorModules = [
      {
        key: 'heatmapEnabled',
        icon: '📊',
        title: 'Activity Heatmap',
        desc: 'Visualização 7x24 de atividade',
        tutorial: 'Gera um mapa de calor mostrando os horários mais ativos de cada contato. Azul = baixa atividade, Vermelho = alta atividade.',
        enabled: true,
      },
      {
        key: 'responseTimeTracking',
        icon: '⏱️',
        title: 'Response Time',
        desc: 'Medição de latência de resposta',
        tutorial: 'Mede o tempo médio que cada contato leva para responder suas mensagens. Calcula padrões e tendências.',
        enabled: true,
      },
      {
        key: 'engagementScoring',
        icon: '🏆',
        title: 'Engagement Scoring',
        desc: 'Ranking de engajamento',
        tutorial: 'Classifica contatos por nível de engajamento baseado em frequência, velocidade de resposta e volume de mensagens.',
        enabled: true,
      },
      {
        key: 'ghostingPrediction',
        icon: '👻',
        title: 'Ghosting Prediction',
        desc: 'Predição de ghosting',
        tutorial: 'Usa algoritmos para prever quando um contato pode parar de responder baseado em padrões históricos.',
        enabled: true,
      },
      {
        key: 'patternDetection',
        icon: '🔄',
        title: 'Pattern Detection',
        desc: 'Detecção de padrões',
        tutorial: 'Identifica padrões de comportamento como horários preferidos, dias mais ativos, e tendências de comunicação.',
        enabled: true,
      },
      {
        key: 'sentimentAnalysis',
        icon: '😊',
        title: 'Sentiment Analysis',
        desc: 'Análise de sentimento',
        tutorial: 'Analisa o tom das mensagens recebidas classificando como positivo, neutro ou negativo.',
        enabled: false,
      },
    ];

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">📈 Behavioral Analytics - Análise Comportamental</h1>
          <p class="page__subtitle">Análise profunda de padrões de comportamento e engajamento dos contatos</p>
        </div>

        <!-- Stats -->
        <div class="kpi-grid mb-lg">
          ${renderKpiCard('🔮', predictions.length || 0, 'Predições Ativas', '', '')}
          ${renderKpiCard('👻', ghosting.length || 0, 'Alertas Ghosting', '', '')}
          ${renderKpiCard('🏆', engagement.length || 0, 'Contatos Rankeados', '', '')}
          ${renderKpiCard('⏱️', '1.2s', 'Latência Média', '', '')}
        </div>

        <!-- Behavioral Modules -->
        <div class="grid grid--2 gap-lg mb-lg">
          ${behaviorModules.map(m => `
            <div class="card">
              <div class="card__header">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 28px;">${m.icon}</span>
                  <div>
                    <h3 class="card__title" style="margin: 0;">${m.title}</h3>
                    <span class="text-muted">${m.desc}</span>
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleBehaviorModule('${m.key}', this.checked)">
                  <span class="toggle-switch__slider"></span>
                </label>
              </div>
              <div class="card__content">
                <div class="tutorial-box" style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md);">
                  <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <span>📖</span>
                    <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">${m.tutorial}</p>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Heatmap Preview -->
        <div class="card mb-lg">
          <div class="card__header">
            <h3 class="card__title">📊 Activity Heatmap Preview (7x24)</h3>
          </div>
          <div class="card__content">
            ${renderHeatmap()}
          </div>
        </div>

        <!-- Engagement Ranking -->
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">🏆 Top Engagement Ranking</h3>
          </div>
          <div class="card__content">
            ${renderEngagementList(engagement)}
          </div>
        </div>
      </div>
    `;
  },

  // Forensics Enhanced Page
  async forensicsEnhanced() {
    const forensicsModules = [
      {
        key: 'timezoneInference',
        icon: '🌍',
        title: 'Timezone Inference',
        desc: 'Inferência de fuso horário',
        tutorial: 'Analisa padrões de atividade para inferir a localização e fuso horário aproximado do contato.',
        enabled: true,
        stats: 'Contatos mapeados: 0',
      },
      {
        key: 'deviceFingerprint',
        icon: '📱',
        title: 'Device Fingerprint',
        desc: 'Identificação única de dispositivo',
        tutorial: 'Coleta informações sobre dispositivos usados pelo contato: modelo, OS, versão do WhatsApp.',
        enabled: true,
        stats: 'Dispositivos identificados: 0',
      },
      {
        key: 'mediaMetadata',
        icon: '🖼️',
        title: 'Media Metadata',
        desc: 'Extração EXIF, GPS, dimensões',
        tutorial: 'Extrai automaticamente metadados de imagens e vídeos recebidos: coordenadas GPS, câmera, data original.',
        enabled: true,
        stats: 'Arquivos analisados: 0',
      },
      {
        key: 'contactTimeline',
        icon: '📅',
        title: 'Contact Timeline',
        desc: 'Histórico completo de interações',
        tutorial: 'Mantém uma linha do tempo detalhada de todas as interações com cada contato.',
        enabled: true,
        stats: 'Eventos registrados: 0',
      },
      {
        key: 'writingAnalysis',
        icon: '✍️',
        title: 'Writing Analysis',
        desc: 'Análise de padrões de escrita',
        tutorial: 'Analisa vocabulário, formalidade, uso de emojis e abreviações para criar perfil de escrita.',
        enabled: true,
        stats: 'Perfis criados: 0',
      },
      {
        key: 'networkAnalysis',
        icon: '🕸️',
        title: 'Network Analysis',
        desc: 'Análise de rede social',
        tutorial: 'Mapeia conexões entre contatos em grupos comuns para visualizar rede social.',
        enabled: false,
        stats: 'Conexões mapeadas: 0',
      },
      {
        key: 'messageForensics',
        icon: '🔬',
        title: 'Message Forensics',
        desc: 'Análise forense de mensagens',
        tutorial: 'Detecta manipulações como fake quotes, ghost mentions e outras anomalias no protocolo.',
        enabled: true,
        stats: 'Anomalias detectadas: 0',
      },
      {
        key: 'callAnalysis',
        icon: '📞',
        title: 'Call Analysis',
        desc: 'Análise de chamadas VoIP',
        tutorial: 'Extrai metadados de chamadas: duração, IPs descobertos via ICE, dispositivos usados.',
        enabled: true,
        stats: 'Chamadas analisadas: 0',
      },
    ];

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">🔍 Forensics Enhanced - Análise Forense</h1>
          <p class="page__subtitle">Módulos avançados de análise forense e extração de dados</p>
        </div>

        <!-- Quick Stats -->
        <div class="kpi-grid mb-lg">
          ${renderKpiCard('📱', 0, 'Dispositivos', '', '')}
          ${renderKpiCard('🖼️', 0, 'Mídia Analisada', '', '')}
          ${renderKpiCard('📅', 0, 'Eventos Timeline', '', '')}
          ${renderKpiCard('🔬', 0, 'Anomalias', '', '')}
        </div>

        <!-- Forensics Modules Grid -->
        <div class="grid grid--2 gap-lg">
          ${forensicsModules.map(m => `
            <div class="card">
              <div class="card__header">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="font-size: 28px;">${m.icon}</span>
                  <div>
                    <h3 class="card__title" style="margin: 0;">${m.title}</h3>
                    <span class="text-muted">${m.desc}</span>
                  </div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" ${m.enabled ? 'checked' : ''} onchange="toggleForensicsModule('${m.key}', this.checked)">
                  <span class="toggle-switch__slider"></span>
                </label>
              </div>
              <div class="card__content">
                <div class="tutorial-box" style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); margin-bottom: 12px;">
                  <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <span>📖</span>
                    <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">${m.tutorial}</p>
                  </div>
                </div>
                <div style="display: flex; justify-content: flex-end;">
                  <span class="text-muted font-mono text-xs">${m.stats}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // Contacts
  async contacts() {
    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">👥 Contacts</h1>
          <p class="page__subtitle">Gerenciamento de contatos</p>
        </div>

        <div class="card">
          <div class="card__header">
            <h3 class="card__title">📋 Lista de Contatos</h3>
            <input type="text" class="input" placeholder="Buscar contato..." style="max-width: 300px;">
          </div>
          <div class="card__content">
            <div class="empty-state">
              <div class="empty-state__icon">👤</div>
              <p class="empty-state__text">Contatos aparecerão após conexão com WhatsApp</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Commands
  async commands() {
    const commands = [
      { name: 'stalk', desc: 'Monitora presença de um contato', usage: '/stalk [número]' },
      { name: 'unstalk', desc: 'Para de monitorar um contato', usage: '/unstalk [número]' },
      { name: 'ghost', desc: 'Ativa/desativa modo fantasma', usage: '/ghost [on|off]' },
      { name: 'antirevoke', desc: 'Ativa/desativa anti-delete', usage: '/antirevoke [on|off]' },
      { name: 'viewonce', desc: 'Ativa/desativa bypass de viewonce', usage: '/viewonce [on|off]' },
      { name: 'status', desc: 'Mostra status do sistema', usage: '/status' },
    ];

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">⌨️ Commands</h1>
          <p class="page__subtitle">Comandos disponíveis no sistema</p>
        </div>

        <div class="card">
          <table class="table">
            <thead>
              <tr><th>Command</th><th>Description</th><th>Usage</th></tr>
            </thead>
            <tbody>
              ${commands.map(c => `
                <tr>
                  <td><span class="badge badge--accent">/${c.name}</span></td>
                  <td>${c.desc}</td>
                  <td class="font-mono text-muted">${c.usage}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Media Lab (ViewOnce Bypassed Media)
  async medialab() {
    const viewonce = await api.getViewOnceSaved();

    // Use real data from API - no fake/mock items
    const mediaItems = Array.isArray(viewonce) ? viewonce.map((item, index) => ({
      id: item.id || index + 1,
      name: item.filename || item.name || `media_${index + 1}`,
      time: item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '--:--:--',
      type: item.mimetype?.includes('video') ? 'video' : 'image',
      badge: 'BYPASSED',
      metadata: item.metadata || null
    })) : [];

    const hasMedia = mediaItems.length > 0;
    const selectedMedia = hasMedia ? mediaItems[0] : null;

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">JARVIS Media Forensic Lab</h1>
        </div>

        <!-- Top Navigation -->
        <div class="top-nav">
          <span class="top-nav__item">Dashboard</span>
          <span class="top-nav__item active">Media Lab</span>
          <span class="top-nav__item">Behavioral Analytics</span>
          <span class="top-nav__item">Settings</span>
        </div>

        <!-- Filter Bar -->
        <div class="filter-bar">
          <input type="text" class="input" placeholder="🔍 Search Media (e.g., filename, hashtag)">
          <select class="filter-bar__select">
            <option>Date Range</option>
            <option>Today</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
          <select class="filter-bar__select">
            <option>File Type (Images, Videos)</option>
            <option>Images Only</option>
            <option>Videos Only</option>
          </select>
          <button class="btn btn--primary">Apply Filters</button>
        </div>

        ${renderSectionHeader('👁️', 'ViewOnce Bypassed Media')}

        <div class="media-layout">
          <!-- Media Grid -->
          <div class="media-grid">
            ${hasMedia ? mediaItems.map((m, i) => `
              <div class="media-item ${i === 0 ? 'selected' : ''}" onclick="selectMedia(${m.id})">
                <div class="media-item__placeholder">${m.type === 'video' ? '🎬' : '🖼️'}</div>
                <span class="media-item__badge">${m.badge}</span>
                <div class="media-item__info">
                  <div class="media-item__time">${m.time}</div>
                </div>
              </div>
            `).join('') : `
              <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📷</div>
                <p class="text-muted">Nenhuma mídia ViewOnce capturada ainda.</p>
                <p class="text-muted text-xs">Mídias de visualização única aparecerão aqui quando forem interceptadas.</p>
              </div>
            `}
          </div>

          <!-- Metadata Panel -->
          <div class="metadata-panel">
            <div class="metadata-panel__title">📋 Media Metadata</div>
            ${selectedMedia ? `
            <div class="metadata-panel__row">
              <span class="metadata-panel__label">File Name</span>
              <span class="metadata-panel__value">${selectedMedia.name}</span>
            </div>
            <div class="metadata-panel__row">
              <span class="metadata-panel__label">Date Extracted</span>
              <span class="metadata-panel__value">${selectedMedia.metadata?.extractedAt || 'N/A'}</span>
            </div>
            <div class="metadata-panel__row">
              <span class="metadata-panel__label">EXIF Data</span>
              <span class="metadata-panel__value">${selectedMedia.metadata?.exif || 'N/A'}</span>
            </div>
            <div class="metadata-panel__row">
              <span class="metadata-panel__label">GPS Location</span>
              <span class="metadata-panel__value">${selectedMedia.metadata?.gps || 'N/A'}</span>
            </div>
            <div class="metadata-panel__row">
              <span class="metadata-panel__label">Device Source</span>
              <span class="metadata-panel__value">${selectedMedia.metadata?.device || 'N/A'}</span>
            </div>
            <div class="metadata-panel__row">
              <span class="metadata-panel__label">Original Dimensions</span>
              <span class="metadata-panel__value">${selectedMedia.metadata?.dimensions || 'N/A'}</span>
            </div>
            <button class="btn btn--secondary mt-md" style="width: 100%;">📥 Download Report</button>
            ` : `
            <div class="empty-state" style="text-align: center; padding: 32px;">
              <p class="text-muted">Selecione uma mídia para ver metadados.</p>
            </div>
            `}
          </div>
        </div>
      </div>
    `;
  },

  // Settings & Health (Based on Reference Image 2)
  async settings() {
    // Fetch real system metrics from API
    const systemStatus = await api.getSystemStatus().catch(() => ({ cpu: 0, memory: 0 }));
    const cpuUsage = systemStatus.cpu || 0;
    const memoryUsage = systemStatus.memory || 0;

    // Generate gauge SVG
    const createGauge = (value, type, label) => {
      const circumference = 2 * Math.PI * 42;
      const offset = circumference - (value / 100) * circumference;
      return `
        <div style="text-align: center;">
          <div class="gauge">
            <svg class="gauge__svg" viewBox="0 0 100 100">
              <circle class="gauge__bg" cx="50" cy="50" r="42" />
              <circle class="gauge__fill gauge__fill--${type}" cx="50" cy="50" r="42" 
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
            </svg>
            <div class="gauge__value" style="color: ${type === 'cpu' ? 'var(--accent-primary)' : 'var(--warning)'};">${value}%</div>
          </div>
          <div class="gauge__label">${label}</div>
        </div>
      `;
    };

    // Mini chart - no random data, show empty bars until real data is available
    const miniChart = Array.from({ length: 20 }, () => 0)
      .map(h => `<div class="mini-chart__bar" style="height: ${h}px;"></div>`).join('');

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">JARVIS System Settings & Health</h1>
        </div>

        <div class="settings-grid">
          <!-- System Health -->
          <div class="card">
            <div class="section-bordered">
              <div class="card__title mb-md">System Health</div>
              <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <span class="text-muted">Dashboard</span>
                <span class="text-muted">Forensic Engine Load</span>
              </div>
              <div class="gauge-container">
                ${createGauge(cpuUsage, 'cpu', 'CPU Usage')}
                ${createGauge(memoryUsage, 'memory', 'Memory Usage')}
                <div style="flex: 1;">
                  <div class="mini-chart">${miniChart}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- API Connections -->
          <div class="card">
            <div class="card__title mb-md">API Connections</div>
            <div class="grid grid--2" style="gap: 16px;">
              <div class="api-card">
                <div class="api-card__title mb-sm">WhatsApp Business API</div>
                <div class="api-card__row">
                  <span class="api-card__label">Account ID</span>
                  <input type="text" class="api-card__input" placeholder="Enter Account ID">
                </div>
                <div class="api-card__row">
                  <span class="api-card__label">API Key</span>
                  <input type="password" class="api-card__input" placeholder="••••••••">
                </div>
                <div class="api-card__row">
                  <span class="api-card__label">Webhook URL</span>
                  <input type="text" class="api-card__input" placeholder="https://...">
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
                  <span class="text-muted">Connected</span>
                  <label class="toggle-switch">
                    <input type="checkbox" checked>
                    <span class="toggle-switch__slider"></span>
                  </label>
                </div>
              </div>
              <div class="api-card">
                <div class="api-card__title mb-sm">OpenAI / LLM Providers</div>
                <div class="api-card__row">
                  <span class="api-card__label">Provider</span>
                  <select class="filter-bar__select" style="flex: 1;">
                    <option>OpenAI (GPT-4)</option>
                    <option>Anthropic (Claude)</option>
                    <option>Local LLM</option>
                  </select>
                </div>
                <div class="api-card__row">
                  <span class="api-card__label">API Key</span>
                  <input type="password" class="api-card__input" placeholder="sk-...">
                </div>
                <button class="btn btn--secondary mt-md">Test Connection</button>
              </div>
            </div>
          </div>

          <!-- Notification Rules -->
          <div class="card">
            <div class="card__title mb-md">Notification Rules (Anomaly Detection)</div>
            <div class="notification-rule">
              <div class="notification-rule__info">
                <div class="notification-rule__icon"></div>
                <span class="notification-rule__text">Unusual Login Activity</span>
              </div>
              <button class="notification-rule__btn">Configure</button>
            </div>
            <div class="notification-rule">
              <div class="notification-rule__info">
                <div class="notification-rule__icon warning"></div>
                <span class="notification-rule__text">High-Risk Keyword Alerts</span>
              </div>
              <button class="notification-rule__btn">Configure</button>
            </div>
            <div class="notification-rule">
              <div class="notification-rule__info">
                <div class="notification-rule__icon danger"></div>
                <span class="notification-rule__text">Mass Message Spikes</span>
              </div>
              <button class="notification-rule__btn">Configure</button>
            </div>
          </div>

          <!-- Security & Privacy -->
          <div class="card">
            <div class="card__title mb-md">Security & Privacy</div>
            <div class="api-card__row">
              <span class="api-card__label" style="min-width: 180px;">Master Password Change</span>
              <button class="btn btn--secondary">Change</button>
            </div>
            <div class="api-card__row">
              <span class="api-card__label" style="min-width: 180px;">Auto-Lock Duration (mins):</span>
              <input type="number" class="api-card__input" value="15" style="max-width: 80px;">
            </div>
            <div class="api-card__row">
              <span class="api-card__label" style="min-width: 180px;">Data Retention Policy</span>
              <select class="filter-bar__select">
                <option>30 days</option>
                <option>90 days</option>
                <option>1 year</option>
                <option>Forever</option>
              </select>
            </div>
            <button class="btn btn--primary mt-md">Save Changes</button>
          </div>
        </div>
      </div>
    `;
  },

  // WhatsApp Connection Page
  async whatsapp() {
    const status = await api.getWhatsAppStatus().catch(() => ({ connected: false, state: 'UNKNOWN' }));
    const qrData = await api.getWhatsAppQRCode().catch(() => ({ qrCode: null, available: false }));

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">📱 WhatsApp Connection</h1>
          <p class="page__subtitle">Conecte seu WhatsApp para habilitar todas as funcionalidades</p>
        </div>

        <div class="grid grid--2">
          <!-- Connection Status -->
          <div class="card">
            <div class="card__header">
              <h3 class="card__title">Status da Conexão</h3>
            </div>
            <div class="card__content">
              <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: ${status.connected ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 71, 87, 0.2)'}; display: flex; align-items: center; justify-content: center; font-size: 32px;">
                  ${status.connected ? '✅' : '📴'}
                </div>
                <div>
                  <div style="font-size: 1.25rem; font-weight: 600; color: ${status.connected ? 'var(--success)' : 'var(--danger)'};">
                    ${status.connected ? 'Conectado' : 'Desconectado'}
                  </div>
                  <div class="text-muted">Estado: ${status.state || 'N/A'}</div>
                </div>
              </div>

              ${status.connected ? `
                <div class="status-grid mb-md">
                  <div class="status-grid__item">
                    <div class="status-grid__label">Nome</div>
                    <div class="status-grid__value">${status.pushName || 'N/A'}</div>
                  </div>
                  <div class="status-grid__item">
                    <div class="status-grid__label">Número</div>
                    <div class="status-grid__value">${status.phoneNumber ? '+' + status.phoneNumber : 'N/A'}</div>
                  </div>
                </div>
                <button class="btn btn--danger" onclick="disconnectWhatsApp()">
                  🔌 Desconectar
                </button>
              ` : `
                <button class="btn btn--primary" onclick="connectWhatsApp()" id="connect-btn">
                  🚀 Iniciar Conexão
                </button>
              `}
            </div>
          </div>

          <!-- QR Code -->
          <div class="card">
            <div class="card__header">
              <h3 class="card__title">QR Code</h3>
              <button class="btn btn--secondary" onclick="refreshQRCode()" style="font-size: 12px;">🔄 Atualizar</button>
            </div>
            <div class="card__content" style="display: flex; flex-direction: column; align-items: center;">
              <div id="qr-container" style="width: 256px; height: 256px; background: var(--bg-tertiary); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; border: 2px dashed var(--border-color);">
                ${qrData.available && qrData.qrCode ? `
                  <div id="qr-code" style="padding: 16px; background: white; border-radius: 8px;"></div>
                ` : `
                  <div style="text-align: center; color: var(--text-muted);">
                    <div style="font-size: 48px; margin-bottom: 8px;">📷</div>
                    <div>Clique em "Iniciar Conexão"<br>para gerar o QR Code</div>
                  </div>
                `}
              </div>
              <p class="text-muted text-center" style="font-size: 12px;">
                Abra o WhatsApp no seu celular → Menu (⋮) → Aparelhos Conectados → Conectar um aparelho
              </p>
            </div>
          </div>
        </div>

        <!-- Connection Instructions -->
        <div class="card mt-lg">
          <div class="card__header">
            <h3 class="card__title">📋 Instruções</h3>
          </div>
          <div class="card__content">
            <div class="timeline">
              <div class="timeline__item">
                <div class="timeline__marker">1</div>
                <div class="timeline__content">
                  <div class="timeline__title">Clique em "Iniciar Conexão"</div>
                  <div class="timeline__desc">O sistema irá inicializar o cliente WhatsApp Web</div>
                </div>
              </div>
              <div class="timeline__item">
                <div class="timeline__marker">2</div>
                <div class="timeline__content">
                  <div class="timeline__title">Aguarde o QR Code aparecer</div>
                  <div class="timeline__desc">Pode levar alguns segundos para o navegador iniciar</div>
                </div>
              </div>
              <div class="timeline__item">
                <div class="timeline__marker">3</div>
                <div class="timeline__content">
                  <div class="timeline__title">Escaneie com seu celular</div>
                  <div class="timeline__desc">Abra o WhatsApp → Menu → Aparelhos Conectados → Conectar</div>
                </div>
              </div>
              <div class="timeline__item">
                <div class="timeline__marker">✓</div>
                <div class="timeline__content">
                  <div class="timeline__title">Pronto!</div>
                  <div class="timeline__desc">O JARVIS terá acesso a todas as funcionalidades do WhatsApp</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Terminal Log -->
        <div class="card mt-lg">
          <div class="card__header">
            <h3 class="card__title">📟 Log de Conexão</h3>
          </div>
          <div class="card__content">
            <div id="connection-log" style="background: var(--bg-primary); border-radius: var(--radius-md); padding: 16px; font-family: var(--font-mono); font-size: 12px; max-height: 200px; overflow-y: auto;">
              <div style="color: var(--text-muted);">[SYSTEM] Aguardando início da conexão...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Protocol Analysis Page
  async protocol() {
    const overview = await api.getForensicsOverview().catch(() => ({ stats: {}, protocolInfo: {}, endpoints: {} }));
    const protocol = await api.getForensicsProtocol().catch(() => ({ binaryTags: {}, protobuf: {}, contextInfo: {}, voip: {} }));

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">🔬 Protocol Analysis</h1>
          <p class="page__subtitle">WhatsApp Multi-Device protocol reverse engineering and forensic analysis</p>
        </div>

        <!-- Protocol Overview -->
        <div class="card mb-lg">
          <div class="card__header">
            <h3 class="card__title">📡 Network Architecture</h3>
          </div>
          <div class="card__content">
            <div class="grid grid--2 gap-md">
              <div class="api-card">
                <div class="api-card__header">
                  <span class="api-card__title">Signaling Layer (WSS)</span>
                  <span class="badge badge--success">Primary</span>
                </div>
                <div class="api-card__row">
                  <span class="api-card__label">Endpoint</span>
                  <code class="font-mono text-xs">${overview.endpoints?.signaling || 'wss://web.whatsapp.com/ws/chat'}</code>
                </div>
                <div class="api-card__row">
                  <span class="api-card__label">Encryption</span>
                  <code class="font-mono text-xs">${overview.protocolInfo?.noiseVersion || 'Noise_XX_25519_AESGCM_SHA256'}</code>
                </div>
                <div class="api-card__row">
                  <span class="api-card__label">Serialization</span>
                  <code class="font-mono text-xs">Protocol Buffers v3</code>
                </div>
              </div>
              
              <div class="api-card">
                <div class="api-card__header">
                  <span class="api-card__title">Media Layer (HTTPS)</span>
                  <span class="badge badge--info">CDN</span>
                </div>
                <div class="api-card__row">
                  <span class="api-card__label">General Media</span>
                  <code class="font-mono text-xs">${overview.endpoints?.media || 'mmg.whatsapp.net'}</code>
                </div>
                <div class="api-card__row">
                  <span class="api-card__label">Profile Pictures</span>
                  <code class="font-mono text-xs">${overview.endpoints?.profilePics || 'pps.whatsapp.net'}</code>
                </div>
                <div class="api-card__row">
                  <span class="api-card__label">CDN Cache</span>
                  <code class="font-mono text-xs">${overview.endpoints?.cdn || '*.cdn.whatsapp.net'}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Binary Tags -->
        <div class="card mb-lg">
          <div class="card__header">
            <h3 class="card__title">🏷️ Binary Tag Dictionary (WABinary)</h3>
          </div>
          <div class="card__content">
            <p class="text-muted mb-md">WhatsApp uses tokenized binary XML instead of plain text. Tags are replaced with single-byte tokens.</p>
            <div class="grid grid--4 gap-sm">
              <div class="kpi-card">
                <div class="kpi-card__value font-mono">0x05</div>
                <div class="kpi-card__label">message</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-card__value font-mono">0x06</div>
                <div class="kpi-card__label">ack</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-card__value font-mono">0x07</div>
                <div class="kpi-card__label">receipt</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-card__value font-mono">0x08</div>
                <div class="kpi-card__label">call</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-card__value font-mono">0x09</div>
                <div class="kpi-card__label">presence</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-card__value font-mono">0x0A</div>
                <div class="kpi-card__label">iq</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-card__value font-mono">0x28</div>
                <div class="kpi-card__label">offer</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-card__value font-mono">0x29</div>
                <div class="kpi-card__label">answer</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Protobuf Structure -->
        <div class="card mb-lg">
          <div class="card__header">
            <h3 class="card__title">📦 Protobuf Structure (WebMessageInfo)</h3>
          </div>
          <div class="card__content">
            <div class="grid grid--2 gap-md">
              <div>
                <h4 class="text-accent mb-sm">Main Fields</h4>
                <table style="width: 100%; font-size: 12px;">
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <th style="text-align: left; padding: 8px;">Tag</th>
                    <th style="text-align: left; padding: 8px;">Field</th>
                    <th style="text-align: left; padding: 8px;">Type</th>
                  </tr>
                  <tr><td style="padding: 6px;"><code>1</code></td><td>key</td><td>MessageKey</td></tr>
                  <tr><td style="padding: 6px;"><code>2</code></td><td>message</td><td>Message</td></tr>
                  <tr><td style="padding: 6px;"><code>3</code></td><td>messageTimestamp</td><td>uint64</td></tr>
                  <tr><td style="padding: 6px;"><code>4</code></td><td>status</td><td>WebMessageInfoStatus</td></tr>
                  <tr><td style="padding: 6px;"><code>5</code></td><td>participant</td><td>string (group only)</td></tr>
                  <tr><td style="padding: 6px;"><code>19</code></td><td>pushName</td><td>string</td></tr>
                </table>
              </div>
              <div>
                <h4 class="text-accent mb-sm">Message Types</h4>
                <table style="width: 100%; font-size: 12px;">
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <th style="text-align: left; padding: 8px;">Tag</th>
                    <th style="text-align: left; padding: 8px;">Type</th>
                    <th style="text-align: left; padding: 8px;">Risk</th>
                  </tr>
                  <tr><td style="padding: 6px;"><code>1</code></td><td>conversation</td><td>⚪ Low</td></tr>
                  <tr><td style="padding: 6px;"><code>6</code></td><td>extendedTextMessage</td><td>🔴 High</td></tr>
                  <tr><td style="padding: 6px;"><code>3</code></td><td>imageMessage</td><td>🟡 Medium</td></tr>
                  <tr><td style="padding: 6px;"><code>37</code></td><td>viewOnceMessage</td><td>🔴 High</td></tr>
                  <tr><td style="padding: 6px;"><code>36</code></td><td>reactionMessage</td><td>🟡 Medium</td></tr>
                  <tr><td style="padding: 6px;"><code>12</code></td><td>protocolMessage</td><td>⚪ Low</td></tr>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- ContextInfo Vulnerabilities -->
        <div class="card mb-lg" style="border-color: var(--warning);">
          <div class="card__header">
            <h3 class="card__title">⚠️ ContextInfo Vulnerabilities</h3>
            <span class="badge badge--warning">Critical Attack Surface</span>
          </div>
          <div class="card__content">
            <p class="text-muted mb-md">O ContextInfo é construído pelo remetente e confiado pelo receptor sem validação do servidor.</p>
            <div class="grid grid--3 gap-md">
              <div class="alert-card alert-card--critical">
                <div class="alert-card__header">
                  <span class="alert-card__icon">🎭</span>
                  <span class="alert-card__type">Fake Quote Injection</span>
                </div>
                <div class="alert-card__content">
                  <p>Fabricar mensagens de resposta com conteúdo falso atribuído à vítima.</p>
                  <code class="text-xs">quotedMessage + stanzaId + participant</code>
                </div>
              </div>
              <div class="alert-card alert-card--warning">
                <div class="alert-card__header">
                  <span class="alert-card__icon">👻</span>
                  <span class="alert-card__type">Ghost Mentions</span>
                </div>
                <div class="alert-card__content">
                  <p>Notificar usuários sem menção visível no texto da mensagem.</p>
                  <code class="text-xs">mentionedJid[] sem @ no texto</code>
                </div>
              </div>
              <div class="alert-card alert-card--warning">
                <div class="alert-card__header">
                  <span class="alert-card__icon">👁️</span>
                  <span class="alert-card__type">ViewOnce Bypass</span>
                </div>
                <div class="alert-card__content">
                  <p>Mídia efêmera pode ser salvada ignorando a flag viewOnce.</p>
                  <code class="text-xs">viewOnce: true (UI-only)</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- VoIP Analysis -->
        <div class="card mb-lg">
          <div class="card__header">
            <h3 class="card__title">📞 VoIP Signaling Analysis</h3>
          </div>
          <div class="card__content">
            <div class="grid grid--2 gap-md">
              <div>
                <h4 class="text-accent mb-sm">Signaling Flow</h4>
                <div class="timeline">
                  <div class="timeline__item">
                    <div class="timeline__marker">1</div>
                    <div class="timeline__content">
                      <div class="timeline__title">OFFER</div>
                      <div class="timeline__desc">SDP com ICE candidates (IPs públicos/privados)</div>
                    </div>
                  </div>
                  <div class="timeline__item">
                    <div class="timeline__marker">2</div>
                    <div class="timeline__content">
                      <div class="timeline__title">ANSWER</div>
                      <div class="timeline__desc">Aceite com device info e SRTP keys</div>
                    </div>
                  </div>
                  <div class="timeline__item">
                    <div class="timeline__marker">3</div>
                    <div class="timeline__content">
                      <div class="timeline__title">MEDIA</div>
                      <div class="timeline__desc">SRTP (Opus audio, VP8 video)</div>
                    </div>
                  </div>
                  <div class="timeline__item">
                    <div class="timeline__marker">✓</div>
                    <div class="timeline__content">
                      <div class="timeline__title">TERMINATE</div>
                      <div class="timeline__desc">duration, reason, media_stats</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 class="text-accent mb-sm">Forensic Value</h4>
                <div class="status-grid">
                  <div class="status-grid__item">
                    <div class="status-grid__label">IP Discovery</div>
                    <div class="status-grid__value text-success">ICE Candidates</div>
                  </div>
                  <div class="status-grid__item">
                    <div class="status-grid__label">Device Fingerprint</div>
                    <div class="status-grid__value text-success">User-Agent</div>
                  </div>
                  <div class="status-grid__item">
                    <div class="status-grid__label">Duration</div>
                    <div class="status-grid__value text-success">Milliseconds</div>
                  </div>
                  <div class="status-grid__item">
                    <div class="status-grid__label">Multi-Device</div>
                    <div class="status-grid__value text-success">Fan-out Detection</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Capture Control -->
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">🎯 Forensics Capture</h3>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn--primary" onclick="startForensicsCapture()">▶️ Start Capture</button>
              <button class="btn btn--secondary" onclick="stopForensicsCapture()">⏹️ Stop</button>
            </div>
          </div>
          <div class="card__content">
            <div class="status-grid">
              <div class="status-grid__item">
                <div class="status-grid__label">Status</div>
                <div class="status-grid__value">${overview.isCapturing ? '🟢 Active' : '🔴 Inactive'}</div>
              </div>
              <div class="status-grid__item">
                <div class="status-grid__label">Presence Events</div>
                <div class="status-grid__value">${overview.stats?.presenceEvents || 0}</div>
              </div>
              <div class="status-grid__item">
                <div class="status-grid__label">Call Events</div>
                <div class="status-grid__value">${overview.stats?.callEvents || 0}</div>
              </div>
              <div class="status-grid__item">
                <div class="status-grid__label">Anomalies Detected</div>
                <div class="status-grid__value text-warning">${overview.stats?.anomaliesDetected || 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Messages - Chat Interface with Real API
  async messages() {
    const status = await api.getWhatsAppStatus().catch(() => ({ connected: false }));
    const chats = status.connected ? await api.getChats().catch(() => []) : [];

    // Store globally for message functions
    window.currentChats = chats;
    window.selectedChatId = null;
    window.selectedChatMessages = [];

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">💬 Mensagens</h1>
          <p class="page__subtitle">Gerenciamento de conversas do WhatsApp</p>
        </div>

        ${!status.connected ? `
          <div class="card">
            <div class="card__content" style="text-align: center; padding: 48px;">
              <div style="font-size: 64px; margin-bottom: 16px;">📵</div>
              <h3 style="margin-bottom: 8px;">WhatsApp Desconectado</h3>
              <p class="text-muted mb-lg">Conecte o WhatsApp para ver suas conversas</p>
              <button class="btn btn--primary" onclick="app.navigate('whatsapp')">
                🔗 Ir para Conexão WhatsApp
              </button>
            </div>
          </div>
        ` : `
          <div class="messages-layout">
            <!-- Chat List -->
            <div class="chat-list-container">
              <div class="card" style="height: 100%;">
                <div class="card__header">
                  <h3 class="card__title">📋 Conversas (${chats.length})</h3>
                  <button class="btn btn--secondary" onclick="refreshChats()" style="font-size: 12px;">🔄</button>
                </div>
                <div class="card__content chat-list" style="max-height: 500px; overflow-y: auto;">
                  ${chats.length > 0 ? chats.slice(0, 50).map(chat => `
                    <div class="chat-item ${window.selectedChatId === chat.id ? 'active' : ''}" 
                         onclick="selectChat('${chat.id}')" 
                         data-chat-id="${chat.id}">
                      <div class="chat-item__avatar">${chat.isGroup ? '👥' : '👤'}</div>
                      <div class="chat-item__info">
                        <div class="chat-item__name">${chat.name || 'Unknown'}</div>
                        <div class="chat-item__preview text-muted text-xs">
                          ${chat.unreadCount > 0 ? `<span class="badge badge--primary">${chat.unreadCount}</span>` : ''}
                          Clique para ver mensagens
                        </div>
                      </div>
                    </div>
                  `).join('') : `
                    <div class="empty-state" style="text-align: center; padding: 32px;">
                      <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
                      <p class="text-muted">Nenhuma conversa encontrada</p>
                    </div>
                  `}
                </div>
              </div>
            </div>

            <!-- Message View -->
            <div class="message-view-container">
              <div class="card" style="height: 100%; display: flex; flex-direction: column;">
                <div class="card__header" id="message-header">
                  <h3 class="card__title">💬 Selecione uma conversa</h3>
                </div>
                <div class="card__content message-list" id="message-list" style="flex: 1; overflow-y: auto; max-height: 400px;">
                  <div class="empty-state" style="text-align: center; padding: 48px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">👈</div>
                    <p class="text-muted">Selecione uma conversa para ver as mensagens</p>
                  </div>
                </div>
                <div class="message-composer" id="message-composer" style="display: none;">
                  <div style="display: flex; gap: 8px; padding: 16px; border-top: 1px solid var(--border-color);">
                    <input type="text" id="message-input" class="form-input" 
                           placeholder="Digite sua mensagem..." 
                           style="flex: 1;"
                           onkeypress="if(event.key === 'Enter') sendMessageFromUI()">
                    <button class="btn btn--primary" onclick="sendMessageFromUI()">
                      📤 Enviar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `}
      </div>

      <style>
        .messages-layout {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 16px;
          min-height: 600px;
        }
        .chat-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid var(--border-color);
        }
        .chat-item:hover, .chat-item.active {
          background: var(--bg-tertiary);
        }
        .chat-item__avatar {
          width: 40px;
          height: 40px;
          background: var(--accent-primary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .chat-item__name {
          font-weight: 600;
          margin-bottom: 2px;
        }
        .message-bubble {
          max-width: 70%;
          padding: 10px 14px;
          border-radius: 16px;
          margin-bottom: 8px;
        }
        .message-bubble.sent {
          background: var(--accent-primary);
          color: white;
          margin-left: auto;
          border-bottom-right-radius: 4px;
        }
        .message-bubble.received {
          background: var(--bg-tertiary);
          margin-right: auto;
          border-bottom-left-radius: 4px;
        }
        .message-time {
          font-size: 10px;
          opacity: 0.7;
          margin-top: 4px;
        }
        @media (max-width: 768px) {
          .messages-layout { grid-template-columns: 1fr; }
        }
      </style>
    `;
  },

  // Contacts - Real Contacts List
  async contacts() {
    const status = await api.getWhatsAppStatus().catch(() => ({ connected: false }));
    const contacts = status.connected ? await api.getContacts().catch(() => []) : [];

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">👥 Contatos</h1>
          <p class="page__subtitle">Lista de contatos do WhatsApp (${contacts.length || 0})</p>
        </div>

        ${!status.connected ? `
          <div class="card">
            <div class="card__content" style="text-align: center; padding: 48px;">
              <div style="font-size: 64px; margin-bottom: 16px;">📵</div>
              <h3 style="margin-bottom: 8px;">WhatsApp Desconectado</h3>
              <p class="text-muted mb-lg">Conecte o WhatsApp para ver seus contatos</p>
              <button class="btn btn--primary" onclick="app.navigate('whatsapp')">
                🔗 Ir para Conexão WhatsApp
              </button>
            </div>
          </div>
        ` : `
          <div class="card">
            <div class="card__header">
              <h3 class="card__title">📋 Lista de Contatos</h3>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="contact-search" class="form-input" 
                       placeholder="Buscar contato..." style="width: 200px;"
                       oninput="filterContacts(this.value)">
                <button class="btn btn--secondary" onclick="app.navigate('contacts')">🔄</button>
              </div>
            </div>
            <div class="card__content">
              <div class="contacts-grid" id="contacts-grid">
                ${contacts.length > 0 ? contacts.map(contact => `
                  <div class="contact-card" data-name="${(contact.name || '').toLowerCase()}">
                    <div class="contact-card__avatar">👤</div>
                    <div class="contact-card__info">
                      <div class="contact-card__name">${contact.name || 'Unknown'}</div>
                      <div class="contact-card__id text-muted text-xs">${contact.id?.split('@')[0] || ''}</div>
                    </div>
                    <button class="btn btn--primary btn--sm" onclick="startChatWith('${contact.id}')">
                      💬
                    </button>
                  </div>
                `).join('') : `
                  <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                    <p class="text-muted">Nenhum contato encontrado</p>
                  </div>
                `}
              </div>
            </div>
          </div>
        `}
      </div>

      <style>
        .contacts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .contact-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
        }
        .contact-card__avatar {
          width: 40px;
          height: 40px;
          background: var(--accent-secondary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .contact-card__info { flex: 1; }
        .contact-card__name { font-weight: 600; }
      </style>
    `;
  },

  // Deleted Messages (Anti-Delete Feature)
  async deleted() {
    const deleted = await api.getDeletedMessages().catch(() => []);
    const messages = Array.isArray(deleted) ? deleted : [];

    return `
      <div class="page">
        <div class="page__header">
          <h1 class="page__title">🗑️ Mensagens Deletadas</h1>
          <p class="page__subtitle">Mensagens capturadas pelo Anti-Delete (${messages.length})</p>
        </div>

        <div class="card">
          <div class="card__header">
            <h3 class="card__title">📋 Mensagens Interceptadas</h3>
            <button class="btn btn--secondary" onclick="app.navigate('deleted')">🔄 Atualizar</button>
          </div>
          <div class="card__content">
            ${messages.length > 0 ? `
              <div class="deleted-messages-list">
                ${messages.map(msg => `
                  <div class="deleted-message-item">
                    <div class="deleted-message-item__header">
                      <span class="deleted-message-item__from">👤 ${msg.from || 'Unknown'}</span>
                      <span class="deleted-message-item__time">${msg.deletedAt ? new Date(msg.deletedAt).toLocaleString() : ''}</span>
                    </div>
                    <div class="deleted-message-item__body">
                      ${msg.body || '[Sem texto]'}
                    </div>
                    <div class="deleted-message-item__meta">
                      <span class="badge badge--info">${msg.type || 'text'}</span>
                      ${msg.hasMedia ? '<span class="badge badge--warning">📎 Mídia</span>' : ''}
                      <span class="text-muted text-xs">Original: ${msg.timestamp ? new Date(msg.timestamp).toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="empty-state" style="text-align: center; padding: 48px;">
                <div style="font-size: 64px; margin-bottom: 16px;">🛡️</div>
                <h3 style="margin-bottom: 8px;">Nenhuma mensagem deletada capturada</h3>
                <p class="text-muted">Quando alguém deletar uma mensagem, ela será salva aqui.</p>
                <p class="text-muted text-xs">Certifique-se que o Anti-Delete está ativado no God Mode.</p>
              </div>
            `}
          </div>
        </div>
      </div>

      <style>
        .deleted-messages-list { display: flex; flex-direction: column; gap: 12px; }
        .deleted-message-item {
          background: var(--bg-tertiary);
          border-radius: var(--radius-md);
          padding: 16px;
          border-left: 4px solid var(--danger);
        }
        .deleted-message-item__header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .deleted-message-item__from { font-weight: 600; color: var(--danger); }
        .deleted-message-item__time { font-size: 12px; color: var(--text-muted); }
        .deleted-message-item__body {
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: var(--radius-sm);
          margin-bottom: 8px;
        }
        .deleted-message-item__meta { display: flex; gap: 8px; align-items: center; }
      </style>
    `;
  },
};

// =============================================
// Application
// =============================================

class App {
  constructor() {
    this.currentPage = 'overview';
    this.init();
  }

  async init() {
    this.bindNavigation();
    this.startClock();
    this.initTerminal();
    await this.navigate(this.currentPage);
    this.log('JARVIS ULTIMATE v7.5.0 - System Log', 'info');
    this.log('Initializing JARVIS ULTIMATE...', 'info');
    this.log('System status: HEALTHY', 'success');
    this.log('Forensics module active', 'success');
  }

  bindNavigation() {
    document.querySelectorAll('.sidebar__item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) this.navigate(page);
      });
    });
  }

  async navigate(page) {
    if (!pages[page]) return;

    // Update active state
    document.querySelectorAll('.sidebar__item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Show loading
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
      const content = await pages[page]();
      main.innerHTML = content;
      this.currentPage = page;
    } catch (error) {
      main.innerHTML = `<div class="empty-state"><div class="empty-state__icon">❌</div><p class="empty-state__text">Error loading page: ${error.message}</p></div>`;
    }
  }

  startClock() {
    const update = () => {
      const now = new Date();
      document.getElementById('clock').textContent = now.toLocaleTimeString('pt-BR');
    };
    update();
    setInterval(update, 1000);
  }

  initTerminal() {
    this.terminalContent = document.getElementById('terminal-content');
  }

  log(message, type = 'info') {
    if (!this.terminalContent) return;
    const time = new Date().toLocaleTimeString('pt-BR');
    const line = document.createElement('div');
    line.className = 'terminal__line';
    line.innerHTML = `<span class="terminal__time">[${time}]</span><span class="terminal__message ${type}">${message}</span>`;
    this.terminalContent.appendChild(line);
    this.terminalContent.scrollTop = this.terminalContent.scrollHeight;
  }
}

// =============================================
// Global Functions
// =============================================

async function toggleGodMode(key, value) {
  try {
    await api.updateGodModeConfig({ [key]: value });
    app.log(`GodMode ${key}: ${value ? 'ENABLED' : 'DISABLED'}`, value ? 'success' : 'warning');
  } catch (error) {
    app.log(`Failed to update ${key}: ${error.message}`, 'error');
  }
}

function toggleTerminal() {
  document.getElementById('terminal').classList.toggle('collapsed');
}

async function toggleBehaviorModule(key, value) {
  try {
    app.log(`Behavioral ${key}: ${value ? 'ENABLED' : 'DISABLED'}`, value ? 'success' : 'warning');
    // API call would go here
    // await api.updateBehavioralConfig({ [key]: value });
  } catch (error) {
    app.log(`Failed to update ${key}: ${error.message}`, 'error');
  }
}

async function toggleForensicsModule(key, value) {
  try {
    app.log(`Forensics ${key}: ${value ? 'ENABLED' : 'DISABLED'}`, value ? 'success' : 'warning');
    // API call would go here
    // await api.updateForensicsConfig({ [key]: value });
  } catch (error) {
    app.log(`Failed to update ${key}: ${error.message}`, 'error');
  }
}

// WhatsApp Connection Functions
async function connectWhatsApp() {
  const btn = document.getElementById('connect-btn');
  const log = document.getElementById('connection-log');

  if (btn) btn.disabled = true;
  if (btn) btn.innerHTML = '⏳ Iniciando...';

  addConnectionLog('Iniciando conexão WhatsApp...', 'info');

  try {
    await api.connectWhatsApp();
    addConnectionLog('Cliente WhatsApp inicializado', 'success');
    addConnectionLog('Aguardando geração do QR Code...', 'info');

    // Poll for QR code
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      const qrData = await api.getWhatsAppQRCode().catch(() => ({ available: false }));

      if (qrData.available && qrData.qrCode) {
        clearInterval(pollInterval);
        addConnectionLog('QR Code gerado! Escaneie com seu celular.', 'success');
        renderQRCode(qrData.qrCode);
      } else if (attempts > 30) {
        clearInterval(pollInterval);
        addConnectionLog('Timeout aguardando QR Code. Tente novamente.', 'error');
        if (btn) btn.disabled = false;
        if (btn) btn.innerHTML = '🚀 Iniciar Conexão';
      } else {
        addConnectionLog(`Aguardando QR Code... (${attempts}/30)`, 'info');
      }

      // Check if connected
      const status = await api.getWhatsAppStatus().catch(() => ({}));
      if (status.connected) {
        clearInterval(pollInterval);
        addConnectionLog('✅ WhatsApp conectado com sucesso!', 'success');
        setTimeout(() => app.navigate('whatsapp'), 1000);
      }
    }, 2000);

  } catch (error) {
    addConnectionLog(`Erro: ${error.message}`, 'error');
    if (btn) btn.disabled = false;
    if (btn) btn.innerHTML = '🚀 Iniciar Conexão';
  }
}

async function disconnectWhatsApp() {
  addConnectionLog('Desconectando WhatsApp...', 'warning');

  try {
    await api.disconnectWhatsApp();
    addConnectionLog('WhatsApp desconectado.', 'success');
    setTimeout(() => app.navigate('whatsapp'), 1000);
  } catch (error) {
    addConnectionLog(`Erro ao desconectar: ${error.message}`, 'error');
  }
}

async function refreshQRCode() {
  addConnectionLog('Atualizando QR Code...', 'info');

  try {
    const qrData = await api.getWhatsAppQRCode();
    if (qrData.available && qrData.qrCode) {
      renderQRCode(qrData.qrCode);
      addConnectionLog('QR Code atualizado!', 'success');
    } else {
      addConnectionLog('QR Code não disponível. Inicie a conexão primeiro.', 'warning');
    }
  } catch (error) {
    addConnectionLog(`Erro: ${error.message}`, 'error');
  }
}

function renderQRCode(qrString) {
  const container = document.getElementById('qr-container');
  if (!container) return;

  // Use qrcode.js library or create simple text rendering
  container.innerHTML = `
    <div style="padding: 16px; background: white; border-radius: 8px; text-align: center;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrString)}" 
           alt="QR Code" style="width: 200px; height: 200px;" />
    </div>
  `;
}

function addConnectionLog(message, type = 'info') {
  const log = document.getElementById('connection-log');
  if (!log) return;

  const colors = {
    info: 'var(--text-muted)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    error: 'var(--danger)',
  };

  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.style.color = colors[type] || colors.info;
  div.innerHTML = `[${time}] ${message}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

// Forensics Capture Functions
async function startForensicsCapture() {
  try {
    await api.toggleForensicsCapture('start');
    app.log('Forensics capture started', 'success');
    app.navigate('protocol');
  } catch (error) {
    app.log('Failed to start capture: ' + error.message, 'error');
  }
}

async function stopForensicsCapture() {
  try {
    await api.toggleForensicsCapture('stop');
    app.log('Forensics capture stopped', 'warning');
    app.navigate('protocol');
  } catch (error) {
    app.log('Failed to stop capture: ' + error.message, 'error');
  }
}

// =============================================
// Message Handling Functions
// =============================================

// Select a chat and load its messages
async function selectChat(chatId) {
  window.selectedChatId = chatId;

  // Update UI - highlight selected chat
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.toggle('active', item.dataset.chatId === chatId);
  });

  // Find chat name
  const chat = window.currentChats?.find(c => c.id === chatId);
  const chatName = chat?.name || 'Chat';

  // Update header
  const header = document.getElementById('message-header');
  if (header) {
    header.innerHTML = `<h3 class="card__title">💬 ${chatName}</h3>`;
  }

  // Show loading
  const messageList = document.getElementById('message-list');
  if (messageList) {
    messageList.innerHTML = '<div style="text-align: center; padding: 32px;"><div class="spinner"></div><p class="text-muted">Carregando mensagens...</p></div>';
  }

  // Fetch messages
  try {
    const messages = await api.getChatMessages(chatId, 50);
    window.selectedChatMessages = messages || [];

    // Render messages
    if (messageList) {
      if (messages && messages.length > 0) {
        messageList.innerHTML = messages.map(msg => `
          <div class="message-bubble ${msg.fromMe ? 'sent' : 'received'}">
            <div class="message-body">${msg.body || '[Media]'}</div>
            <div class="message-time">${msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleTimeString() : ''}</div>
          </div>
        `).join('');
        messageList.scrollTop = messageList.scrollHeight;
      } else {
        messageList.innerHTML = '<div class="empty-state" style="text-align: center; padding: 48px;"><p class="text-muted">Nenhuma mensagem nesta conversa</p></div>';
      }
    }

    // Show composer
    const composer = document.getElementById('message-composer');
    if (composer) {
      composer.style.display = 'block';
    }

    app.log(`Chat loaded: ${chatName}`, 'info');
  } catch (error) {
    if (messageList) {
      messageList.innerHTML = `<div class="empty-state" style="text-align: center; padding: 48px;"><p class="text-danger">Erro ao carregar mensagens: ${error.message}</p></div>`;
    }
    app.log('Failed to load messages: ' + error.message, 'error');
  }
}

// Send message from UI
async function sendMessageFromUI() {
  const input = document.getElementById('message-input');
  const message = input?.value?.trim();

  if (!message || !window.selectedChatId) {
    app.log('Digite uma mensagem para enviar', 'warning');
    return;
  }

  try {
    input.disabled = true;
    app.log(`Enviando mensagem para ${window.selectedChatId}...`, 'info');

    const result = await api.sendMessage(window.selectedChatId, message);

    if (result?.sent) {
      // Clear input
      input.value = '';

      // Add message to UI immediately
      const messageList = document.getElementById('message-list');
      if (messageList) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message-bubble sent';
        msgDiv.innerHTML = `
          <div class="message-body">${message}</div>
          <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        messageList.appendChild(msgDiv);
        messageList.scrollTop = messageList.scrollHeight;
      }

      app.log('Mensagem enviada com sucesso!', 'success');
    } else {
      throw new Error('Falha ao enviar mensagem');
    }
  } catch (error) {
    app.log('Erro ao enviar: ' + error.message, 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// Refresh chats list
function refreshChats() {
  app.navigate('messages');
}

// Filter contacts by name
function filterContacts(query) {
  const cards = document.querySelectorAll('.contact-card');
  const lowerQuery = query.toLowerCase();

  cards.forEach(card => {
    const name = card.dataset.name || '';
    card.style.display = name.includes(lowerQuery) ? 'flex' : 'none';
  });
}

// Start chat with a contact
function startChatWith(contactId) {
  window.selectedChatId = contactId;
  app.navigate('messages');
  // After navigation, try to select the chat
  setTimeout(() => selectChat(contactId), 500);
}

// Initialize
const app = new App();

