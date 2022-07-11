import { SlashCommandBuilder } from "@discordjs/builders";
import { Client, Message } from "discord.js";

import { IBotCommand, IBotEvent, IBotModule } from "../interfaces/BotModule";

const BOT_MODULE_NAME = "Ping";
const BOT_MODULE_COMMAND_NAME = "ping";

const COMMANDS: IBotCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName(BOT_MODULE_COMMAND_NAME)
      .setDescription(`[${BOT_MODULE_NAME}] Replies with pong!`),
    execute: async interaction => {
      await interaction.reply("Pong!");
    },
  },
];

const EVENTS: IBotEvent[] = [
  {
    event_name: "ready",
    execute: async (client: Client) => {
      // Test
    },
  },
  {
    event_name: "messageCreate",
    execute: async (message: Message) => {
      // Test
      if (message.author.bot) return false;
    },
  },
];

module.exports = {
  bot_module_name: BOT_MODULE_NAME,
  commands: COMMANDS,
  events: EVENTS,
} as IBotModule;
