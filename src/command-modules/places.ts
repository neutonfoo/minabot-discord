import {
  Client,
  CommandInteraction,
  Events,
  Message,
  SlashCommandBuilder,
} from 'discord.js';
import {
  CommandModuleImpl,
  EventListenerImpl,
  SlashCommandImpl,
} from '../models';
import { PlacesManager } from './places.models';
import axios from 'axios';

const {
  PLACES_EMAIL,
  PLACES_PRIVATE_KEY,
  YELP_API_KEY,
  PLACES_CHANNEL_ID,
  PLACES_MAP_LINK,
  PLACES_GOOGLE_SHEETS_ID,
} = process.env;

const NAME = 'Places';
const COMMAND_NAME = 'places';

// # Yelp URL match Regex
const YELP_URL_REGEX =
  /^https\:\/\/www\.yelp\.com\/biz\/(?<businessId>[a-zA-Z0-9-%]+)(\?.+)?$/;

const YELP_SHORT_URL_REGEX =
  /^https\:\/\/yelp\.to\/(?<businessId>[a-zA-Z0-9]+)$/;

const mapsLink = PLACES_MAP_LINK!;
const googleSheetsId = PLACES_GOOGLE_SHEETS_ID!;

const placesManager = new PlacesManager(
  googleSheetsId,
  PLACES_EMAIL!,
  PLACES_PRIVATE_KEY!,
  YELP_API_KEY!,
);

enum SUBCOMMAND_NAMES {
  MAP = 'map',
  SHEETS = 'sheet',
}

const slashCommands: SlashCommandImpl = {
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription(`[${NAME}] module`)
    .addSubcommand((subcommand) =>
      subcommand
        .setName(SUBCOMMAND_NAMES.SHEETS)
        .setDescription(`[${NAME}] Gets the url to the Google Sheets`),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(SUBCOMMAND_NAMES.MAP)
        .setDescription(`[${NAME}] Gets the url to the Mapbox map`),
    ),
  execute: async (interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.options.getSubcommand() === SUBCOMMAND_NAMES.MAP) {
      interaction.reply(`<${mapsLink}>`);
    } else if (
      interaction.options.getSubcommand() === SUBCOMMAND_NAMES.SHEETS
    ) {
      interaction.reply(
        `<https://docs.google.com/spreadsheets/d/${PLACES_GOOGLE_SHEETS_ID}>`,
      );
    }
  },
};

const eventListeners: EventListenerImpl[] = [
  {
    eventName: Events.ClientReady,
    execute: async (client: Client) => {
      // Need to inject client because modal submissions handled globally
      placesManager.injectClient(client);
      await placesManager.connect();
    },
  },
  {
    eventName: Events.MessageCreate,
    execute: async (message: Message) => {
      if (message.channelId === PLACES_CHANNEL_ID) {
        let urlToCheck = message.content;

        const yelpShortUrlMatches = urlToCheck.match(YELP_SHORT_URL_REGEX);
        if (yelpShortUrlMatches) {
          const getReq = await axios.get(urlToCheck);
          urlToCheck = getReq.request.socket._httpMessage.res.responseUrl;
        }

        const yelpUrlMatches = urlToCheck.match(YELP_URL_REGEX);
        if (yelpUrlMatches) {
          const businessId = decodeURI(yelpUrlMatches.groups!.businessId);
          placesManager.processPlace(message, businessId, false);
        }
      }
    },
  },
];

const commandModule: CommandModuleImpl = {
  name: NAME,
  commandName: COMMAND_NAME,
  slashCommands,
  eventListeners,
};

export default commandModule;
