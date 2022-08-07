if (process.env.NODE_ENV !== 'production') require('dotenv').config();

import {
  Collection,
  REST,
  Routes,
  Client,
  GatewayIntentBits,
  Interaction,
  Events,
  TextChannel,
} from 'discord.js';
import { CommandModuleImpl } from './models';

import ping from './command-modules/ping';
import wordle from './command-modules/wordle';
import twiceListening from './command-modules/music-listening';
import craiyon from './command-modules/craiyon';
import places from './command-modules/places';

// Load env variables needed for registration and the client
const { DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, DISCORD_BOT_TOKEN } =
  process.env;

// Create the discord.js client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// List of slash commands to register
const commandModulesToRegister: CommandModuleImpl[] = [
  ping,
  wordle,
  twiceListening,
  craiyon,
  places,
];

// commandModules = Consolidated list of commands. In this format for slash command registering and handling
const commandModules: Collection<string, CommandModuleImpl> = new Collection();
commandModulesToRegister.forEach((commandModuleToRegister) =>
  commandModules.set(
    commandModuleToRegister.commandName,
    commandModuleToRegister,
  ),
);

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN!);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(
        DISCORD_APPLICATION_ID!,
        DISCORD_GUILD_ID!,
      ),
      {
        body: commandModules
          .filter((commandModule) =>
            commandModule.slashCommands ? true : false,
          )
          .mapValues((commandModule) => commandModule.slashCommands!.data)
          .toJSON(),
      },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.on(Events.ClientReady, () => {
  if (client.user) {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(
      `Command Modules loaded: ${commandModules
        .map((_, commandModuleName) => commandModuleName)
        .join(', ')}`,
    );

    if (process.env.NODE_ENV === 'production') {
      const bot_status_channel = client.channels.cache.get(
        process.env.BOT_STATUS_CHANNEL_ID!,
      ) as TextChannel;
      bot_status_channel.send(`${client.user.tag} deployed on **Production**.`);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (commandModules.has(interaction.commandName)) {
    commandModules
      .get(interaction.commandName)
      ?.slashCommands?.execute(interaction);
  }
});

commandModules.forEach((command) => {
  if (command.eventListeners) {
    command.eventListeners.forEach((eventListener) =>
      client.on(eventListener.eventName, async (...args) => {
        try {
          eventListener.execute(...args);
        } catch (err: any) {
          err ? console.error(err) : console.log('Undefined error');
        }
      }),
    );
  }
});

client.login(DISCORD_BOT_TOKEN);
