# JARVIS ULTIMATE

> 🤖 Ferramenta de Inteligência e Análise Forense para WhatsApp

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Features

- 🤖 **Assistente IA** - Powered by Google Gemini 2.0 Flash
- 🔍 **Suite Forense** - ACKs, presença, chamadas, dispositivos
- 📊 **Analytics Comportamental** - Detecção de padrões e anomalias
- 🎯 **Dashboard C2** - Interface cyberpunk para comando e controle
- 🔒 **Arquitetura Modular** - Clean Architecture + DDD

## 🚀 Quick Start

### Pré-requisitos

- Node.js 20+
- Google API Key (Gemini)
- Número WhatsApp para autenticação

### Instalação

```bash
# Clone o repositório
git clone <your-repo-url>
cd jarvis

# Instale dependências
npm install

# Configure ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Execute em desenvolvimento
npm run dev
```

### Primeiro Acesso

1. Execute `npm run dev`
2. Escaneie o QR Code que aparece no terminal
3. Acesse o Dashboard em `http://localhost:3000`

## 📁 Estrutura

```
jarvis-ultimate/
├── src/
│   ├── core/           # Bootstrap, config, errors, events
│   ├── domain/         # Entidades e regras de negócio
│   ├── application/    # Use Cases
│   ├── infrastructure/ # Implementações (HTTP, WhatsApp, DB)
│   └── presentation/   # Dashboard C2
├── tests/              # Testes unitários e integração
├── config/             # Configurações YAML
└── scripts/            # Scripts utilitários
```

## ⚙️ Configuração

### Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `PORT` | Porta do servidor | 3000 |
| `NODE_ENV` | Ambiente (development/production) | development |
| `GOOGLE_API_KEY` | API Key do Google Gemini | - |
| `AUTHORIZED_NUMBERS` | Números autorizados (separados por vírgula) | - |

### Arquivo de Configuração

Edite `config/development.yaml` ou `config/production.yaml`:

```yaml
app:
  logLevel: debug

whatsapp:
  puppeteer:
    headless: false  # true em produção

ai:
  model: gemini-2.0-flash
  temperature: 0.7
```

## 📋 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `/help` | Lista todos os comandos |
| `/ping` | Verifica latência |
| `/status` | Status do sistema |
| `/stalk <número>` | Inicia monitoramento de presença |
| `/profile <número>` | Perfil comportamental |

## 🛠️ Scripts NPM

```bash
npm run dev        # Desenvolvimento com hot-reload
npm run build      # Compila TypeScript
npm run start      # Executa versão compilada
npm run test       # Executa testes
npm run lint       # Verifica código
```

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│                    (Dashboard C2)                            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│              (Use Cases / Orchestration)                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN LAYER                             │
│            (Entities, Services, Interfaces)                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                         │
│        (WhatsApp, HTTP, SQLite, Gemini Adapter)             │
└─────────────────────────────────────────────────────────────┘
```

## 📄 License

MIT © JARVIS ULTIMATE
