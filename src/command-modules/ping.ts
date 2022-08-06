import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  CommandModuleImpl,
  EventListenerImpl,
  SlashCommandImpl,
} from '../models';

const NAME = 'Ping';
const COMMAND_NAME = 'ping';

const slashCommands: SlashCommandImpl = {
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription(`[${NAME}] Responds with pong.`),
  execute: (interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    interaction.reply('Pong');
  },
};

const eventListeners: EventListenerImpl[] = [
  // {
  //   eventName: Events.MessageCreate,
  //   execute: async (message: Message) => {
  //     console.log(message.content);
  //   },
  // },
];

const commandModule: CommandModuleImpl = {
  name: NAME,
  commandName: COMMAND_NAME,
  slashCommands,
  eventListeners,
};

export default commandModule;
