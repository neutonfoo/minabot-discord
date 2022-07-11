import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Client, Collection, Intents } from "discord.js";

import { IBotCommand, IBotEvent, IBotModule } from "./interfaces/BotModule";

if (process.env.NODE_ENV !== "production") require("dotenv").config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID!;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID!;

// const DISCORD_BOT_MODULES = ["./modules/ping", "./modules/wordle"];
const DISCORD_BOT_MODULES = [
  "./modules/wordle",
  "./modules/craiyon",
  "./modules/twice-listening",
];

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_PRESENCES,
  ],
});

const commands = new Collection<string, IBotCommand>();
const events: IBotEvent[] = [];

// Load commands into commands array
for (const bot_module of DISCORD_BOT_MODULES.map(
  DISCORD_BOT_MODULE => require(DISCORD_BOT_MODULE) as IBotModule
)) {
  for (const bot_module_command of bot_module.commands) {
    if (commands.has(bot_module_command.data.name)) {
      console.error(
        `Command '${bot_module_command.data.name}' repeated in module '${bot_module.bot_module_name}'. Exiting.`
      );
      process.exit(1);
    }

    commands.set(bot_module_command.data.name, bot_module_command);
  }

  for (const bot_module_event of bot_module.events) {
    events.push(bot_module_event);
  }
}

// After commands succesfully loaded, register them
const rest = new REST({ version: "9" }).setToken(DISCORD_BOT_TOKEN);
rest
  .put(
    Routes.applicationGuildCommands(DISCORD_APPLICATION_ID, DISCORD_GUILD_ID),
    { body: commands.mapValues(command => command.data).toJSON() }
  )
  .then(() => console.log("Successfully registered application commands."))
  .catch(console.error);

// On ready
client.once("ready", () => {
  console.log(`${client.user?.tag} ready`);
});

// Interaction handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error while executing this command!",
      ephemeral: true,
    });
  }
});

// Event handler
for (const event of events) {
  client.on(event.event_name, async (...args: String[]) => {
    try {
      await event.execute(...args);
    } catch (err) {
      err ? console.error(err) : console.log("Undefined error");
    }
  });
}

client.login(DISCORD_BOT_TOKEN);
