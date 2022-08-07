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
import { createCronJob } from '../utility';
import { setReady as incrementReadyCounter } from '..';

const {
  PLACES_EMAIL,
  PLACES_PRIVATE_KEY,
  YELP_API_KEY,
  PLACES_CHANNEL_ID,
  PLACES_BUCKETLIST_CHANNEL_ID,
  PLACES_MAP_LINK,
  PLACES_GOOGLE_SHEETS_ID,
} = process.env;

const NAME = 'Places';
const COMMAND_NAME = 'places';
const REQUIRE_READY = true;

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
  RANDOM = 'random',
}

const slashCommands: SlashCommandImpl = {
  // Built in buildSlashCommands()
  data: undefined,

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
    } else if (
      interaction.options.getSubcommand() === SUBCOMMAND_NAMES.RANDOM
    ) {
      placesManager.pickRandomPlace();
    }
  },
};

const eventListeners: EventListenerImpl[] = [
  {
    eventName: Events.ClientReady,
    execute: async (client: Client) => {
      placesManager.injectClient(client);
      await placesManager.connect();
      await placesManager.updatePlacesCache();

      buildSlashCommands();

      // Need to inject client because modal submissions handled globally
      cronHourlyCacheReset().start();
      incrementReadyCounter();
    },
  },
  {
    eventName: Events.MessageCreate,
    execute: async (message: Message) => {
      if (
        message.channelId === PLACES_CHANNEL_ID ||
        message.channelId === PLACES_BUCKETLIST_CHANNEL_ID
      ) {
        let urlToCheck = message.content;

        const yelpShortUrlMatches = urlToCheck.match(YELP_SHORT_URL_REGEX);
        if (yelpShortUrlMatches) {
          const getReq = await axios.get(urlToCheck);
          urlToCheck = getReq.request.socket._httpMessage.res.responseUrl;
        }

        const yelpUrlMatches = urlToCheck.match(YELP_URL_REGEX);
        if (yelpUrlMatches) {
          const businessId = decodeURI(yelpUrlMatches.groups!.businessId);
          placesManager.processPlace(
            message,
            businessId,
            message.channelId === PLACES_BUCKETLIST_CHANNEL_ID,
          );
        }
      }
    },
  },
];

const buildSlashCommands = () => {
  slashCommands.data = new SlashCommandBuilder()
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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(SUBCOMMAND_NAMES.RANDOM)
        .setDescription(`[${NAME}] Selects a random place`)
        .addBooleanOption((option) =>
          option.setName('bucketlist').setDescription('Is bucketlist place'),
        )
        .addStringOption((option) =>
          option
            .setName('state')
            .setDescription('Select a state')
            .addChoices(
              ...placesManager.placesCache.states.map((state) => ({
                name: state,
                value: state,
              })),
            ),
        )
        .addStringOption((option) =>
          option
            .setName('city')
            .setDescription('Select a city')
            .addChoices(
              ...placesManager.placesCache.cities.map((city) => ({
                name: city,
                value: city,
              })),
            ),
        )
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Select a type')
            .addChoices(
              ...placesManager.placesCache.tags.map((type) => ({
                name: type,
                value: type,
              })),
            ),
        )
        .addStringOption((option) =>
          option
            .setName('tag')
            .setDescription('Select a tag')
            .addChoices(
              ...placesManager.placesCache.tags.map((tag) => ({
                name: tag,
                value: tag,
              })),
            ),
        ),
    );
};

const cronHourlyCacheReset = () =>
  createCronJob('0 0 * * * *', 'Pacific/Kiritimati', async function () {
    placesManager.updatePlacesCache();
  });

const commandModule: CommandModuleImpl = {
  name: NAME,
  commandName: COMMAND_NAME,
  requireReady: REQUIRE_READY,
  slashCommands,
  eventListeners,
};

export default commandModule;
