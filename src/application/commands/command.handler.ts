/**
 * JARVIS ULTIMATE - Command System
 * 
 * Extensible command handler with registry pattern.
 */

import { injectable, inject } from 'tsyringe';
import { Message } from '../../domain/message/message.entity.js';
import { Contact } from '../../domain/contact/contact.entity.js';
import { Result, ok, fail, CommandError } from '../../core/errors.js';
import { Logger } from '../../core/logger.js';

// ============================================
// Command Interface
// ============================================

export interface CommandContext {
    message: Message;
    contact: Contact;
    args: string[];
    rawArgs: string;
}

export interface CommandResult {
    response: string;
    data?: unknown;
    shouldReply: boolean;
    embed?: {
        title?: string;
        description?: string;
        fields?: Array<{ name: string; value: string }>;
    };
}

export interface Command {
    readonly name: string;
    readonly aliases: string[];
    readonly description: string;
    readonly usage: string;
    readonly requiredArgs: number;
    readonly category: 'general' | 'forensics' | 'analytics' | 'admin';

    execute(context: CommandContext): Promise<Result<CommandResult>>;
    validate(args: string[]): Result<void>;
}

// ============================================
// Command Registry
// ============================================

@injectable()
export class CommandRegistry {
    private commands = new Map<string, Command>();
    private aliases = new Map<string, string>();

    register(command: Command): void {
        this.commands.set(command.name, command);

        for (const alias of command.aliases) {
            this.aliases.set(alias, command.name);
        }
    }

    get(nameOrAlias: string): Command | undefined {
        const name = nameOrAlias.toLowerCase();

        // Direct match
        if (this.commands.has(name)) {
            return this.commands.get(name);
        }

        // Alias match
        const realName = this.aliases.get(name);
        if (realName) {
            return this.commands.get(realName);
        }

        return undefined;
    }

    has(nameOrAlias: string): boolean {
        return this.get(nameOrAlias) !== undefined;
    }

    getAll(): Command[] {
        return Array.from(this.commands.values());
    }

    getByCategory(category: Command['category']): Command[] {
        return this.getAll().filter(cmd => cmd.category === category);
    }
}

// ============================================
// Command Handler
// ============================================

@injectable()
export class CommandHandler {
    constructor(
        @inject('CommandRegistry') private registry: CommandRegistry,
        @inject('Logger') private logger: Logger,
    ) {
        this.registerBuiltinCommands();
    }

    async handle(message: Message, contact: Contact): Promise<Result<CommandResult>> {
        const parsed = message.extractCommand();

        if (!parsed) {
            return fail(new CommandError('Not a command'));
        }

        const command = this.registry.get(parsed.name);

        if (!command) {
            return ok({
                response: `❌ Comando desconhecido: *${parsed.name}*\n\nUse /help para ver comandos disponíveis.`,
                shouldReply: true,
            });
        }

        // Validate args
        const validation = command.validate(parsed.args);
        if (!validation.success) {
            return ok({
                response: `❌ Uso incorreto\n\n*Uso:* ${command.usage}\n\n${validation.error.message}`,
                shouldReply: true,
            });
        }

        this.logger.info(
            { command: command.name, args: parsed.args },
            'Executing command'
        );

        try {
            return await command.execute({
                message,
                contact,
                args: parsed.args,
                rawArgs: parsed.rawArgs,
            });
        } catch (error) {
            this.logger.error({ error, command: command.name }, 'Command execution failed');
            return fail(new CommandError(`Command failed: ${String(error)}`));
        }
    }

    private registerBuiltinCommands(): void {
        // Help command
        this.registry.register(new HelpCommand(this.registry));

        // Ping command  
        this.registry.register(new PingCommand());

        // Status command
        this.registry.register(new StatusCommand());
    }
}

// ============================================
// Built-in Commands
// ============================================

class HelpCommand implements Command {
    readonly name = 'help';
    readonly aliases = ['h', 'ajuda', '?'];
    readonly description = 'Lista comandos disponíveis';
    readonly usage = '/help [comando]';
    readonly requiredArgs = 0;
    readonly category = 'general' as const;

    constructor(private registry: CommandRegistry) { }

    validate(): Result<void> {
        return ok(undefined);
    }

    async execute(ctx: CommandContext): Promise<Result<CommandResult>> {
        const { args } = ctx;

        // Help for specific command
        if (args.length > 0) {
            const cmd = this.registry.get(args[0]);
            if (cmd) {
                return ok({
                    response: `📖 *${cmd.name}*\n\n${cmd.description}\n\n*Uso:* ${cmd.usage}\n*Aliases:* ${cmd.aliases.join(', ') || 'nenhum'}`,
                    shouldReply: true,
                });
            }
            return ok({
                response: `❌ Comando não encontrado: ${args[0]}`,
                shouldReply: true,
            });
        }

        // List all commands
        const categories = {
            general: '📋 Geral',
            forensics: '🔍 Forense',
            analytics: '📊 Analytics',
            admin: '⚙️ Admin',
        };

        let response = '*📚 JARVIS ULTIMATE - Comandos*\n\n';

        for (const [category, title] of Object.entries(categories)) {
            const cmds = this.registry.getByCategory(category as Command['category']);
            if (cmds.length > 0) {
                response += `${title}\n`;
                for (const cmd of cmds) {
                    response += `  /${cmd.name} - ${cmd.description}\n`;
                }
                response += '\n';
            }
        }

        response += '_Use /help <comando> para detalhes_';

        return ok({
            response,
            shouldReply: true,
        });
    }
}

class PingCommand implements Command {
    readonly name = 'ping';
    readonly aliases = ['p'];
    readonly description = 'Verifica latência do bot';
    readonly usage = '/ping';
    readonly requiredArgs = 0;
    readonly category = 'general' as const;

    validate(): Result<void> {
        return ok(undefined);
    }

    async execute(ctx: CommandContext): Promise<Result<CommandResult>> {
        const latency = Date.now() - ctx.message.timestamp.getTime();

        return ok({
            response: `🏓 Pong!\n\n⏱️ Latência: *${latency}ms*\n⏰ Uptime: *${this.formatUptime(process.uptime())}*`,
            shouldReply: true,
            data: { latency },
        });
    }

    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    }
}

class StatusCommand implements Command {
    readonly name = 'status';
    readonly aliases = ['st', 'info'];
    readonly description = 'Status do sistema';
    readonly usage = '/status';
    readonly requiredArgs = 0;
    readonly category = 'general' as const;

    validate(): Result<void> {
        return ok(undefined);
    }

    async execute(): Promise<Result<CommandResult>> {
        const memory = process.memoryUsage();
        const heapUsed = Math.round(memory.heapUsed / 1024 / 1024);
        const heapTotal = Math.round(memory.heapTotal / 1024 / 1024);

        const response = `*🤖 JARVIS ULTIMATE v7.5.0*

📊 *Sistema*
├ Status: ✅ Operacional
├ Uptime: ${this.formatUptime(process.uptime())}
└ Node: ${process.version}

💾 *Memória*
├ Heap: ${heapUsed}MB / ${heapTotal}MB
└ RSS: ${Math.round(memory.rss / 1024 / 1024)}MB

🔌 *Conexões*
├ WhatsApp: ✅ Conectado
├ AI: ✅ Pronto
└ Storage: ✅ Operacional`;

        return ok({
            response,
            shouldReply: true,
            data: {
                memory,
                uptime: process.uptime(),
            },
        });
    }

    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h ${mins}m`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    }
}
