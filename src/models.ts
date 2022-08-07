import {
  SlashCommandBuilder,
  CommandInteraction,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export interface SlashCommandImpl {
  data:
    | undefined
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: CommandInteraction) => void;
}

export interface EventListenerImpl {
  eventName: string;
  execute: (...args: any[]) => void;
}

export interface CommandModuleImpl {
  name: string;
  commandName: string;
  requireReady: boolean;
  slashCommands?: SlashCommandImpl;
  eventListeners?: EventListenerImpl[];
}
