import {
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "@discordjs/builders";
import { CommandInteraction } from "discord.js";

export interface IBotCommand {
  data:
    | Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">
    | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

export interface IBotEvent {
  event_name: string;
  execute: (...args: any[]) => void;
}

export interface IBotModule {
  bot_module_name: string;
  commands: IBotCommand[];
  events: IBotEvent[];
}
