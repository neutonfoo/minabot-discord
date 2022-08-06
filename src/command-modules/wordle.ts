import { CronJob } from 'cron';
import {
  Client,
  CommandInteraction,
  Events,
  Message,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { connect } from 'mongoose';
import {
  CommandModuleImpl,
  EventListenerImpl,
  SlashCommandImpl,
} from '../models';
import { twiceReactionEmojiIds, createCronJob } from '../utility';
import {
  PlayerModel,
  WordleMetaModel,
  NewPlayerBuilder,
  GameImpl,
  PlayerImpl,
} from './wordle.model';

const NAME = 'Wordle';
const COMMAND_NAME = 'wordle';

if (process.env.NODE_ENV !== 'production') require('dotenv').config();

// # Wordle result match Regex
const WORDLE_RESULT_REGEX =
  /^(Wordle|Minactle) (?<wordleIndex>\d+) (?<attempts>[X|1-6])\/6(?<isHardMode>\*?)$/;

const scoringHardMode = 0;
const scoring: number[] = [
  6, // 1 Attempt
  5, // 2 Attempts
  4, // 3 Attempts
  3, // 4 Attempts
  2, // 5 Attempts
  1, // 6 Attempts
  0, // 0 Attempts / Fail
];

const { WORDLE_CHANNEL_ID, MONGODB_URI } = process.env;

let WORDLE_CHANNEL: TextChannel;
const MONGODB_CONNECTION = `${MONGODB_URI}/wordleTracker?retryWrites=true&w=majority`;

enum SUBCOMMAND_NAMES {
  REMINDER = 'reminder',
  WEEKLY_LEADERBOARD = 'leaderboard',
  LIFETIME_LEADERBOARD = 'leaderboard_lifetime',
}

const slashCommands: SlashCommandImpl = {
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription(`[${NAME}] module`)
    .addSubcommand((subcommand) =>
      subcommand
        .setName(SUBCOMMAND_NAMES.REMINDER)
        .setDescription(`[${NAME}] Reminds you of your games`),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(SUBCOMMAND_NAMES.LIFETIME_LEADERBOARD)
        .setDescription(`[${NAME}] Show the lifetime leaderboard`),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(SUBCOMMAND_NAMES.WEEKLY_LEADERBOARD)
        .setDescription(`[${NAME}] Show the weekly leaderboard`),
    ),
  execute: async (interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    if (
      interaction.options.getSubcommand() ===
      SUBCOMMAND_NAMES.LIFETIME_LEADERBOARD
    ) {
      interaction.reply(await leaderboardStr());
    } else if (
      interaction.options.getSubcommand() ===
      SUBCOMMAND_NAMES.WEEKLY_LEADERBOARD
    ) {
      interaction.reply(await weeklyLeaderboardStr());
    } else if (
      interaction.options.getSubcommand() === SUBCOMMAND_NAMES.REMINDER
    ) {
      missingUserGames(interaction);
    }
  },
};

const eventListeners: EventListenerImpl[] = [
  {
    eventName: Events.ClientReady,
    execute: async (client: Client) => {
      WORDLE_CHANNEL = client.channels.cache.get(
        WORDLE_CHANNEL_ID!,
      ) as TextChannel;

      await connect(MONGODB_CONNECTION);

      cronDailyIncrement(client).start();
      cronWeeklyReminder(client).start();
      cronWeeklyReset(client).start();
    },
  },
  {
    eventName: Events.MessageCreate,
    execute: (message: Message) => {
      if (message.author.bot) return false;

      if (message.channelId === WORDLE_CHANNEL_ID) {
        const firstLine = message.content.split(/\r?\n/)[0];
        parseWordle(firstLine, message);
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

async function leaderboardStr(): Promise<string> {
  // # Leaderboard
  const players = await PlayerModel.find().sort({ pointsScore: -1 });

  if (players.length === 0) {
    return 'No players yet.';
  }

  let currentRank = 1;
  let playersInCurrentRank = 0;
  let previousPointScore = 0;
  let isFirstPlayer = true;

  return (
    `**Wordle Leaderboard**\n` +
    players
      .map((player) => {
        if (player.pointsScore < previousPointScore || isFirstPlayer) {
          currentRank = currentRank + playersInCurrentRank;
          playersInCurrentRank = 1;

          isFirstPlayer = false;
        } else if (player.pointsScore === previousPointScore) {
          playersInCurrentRank++;
        }

        previousPointScore = player.pointsScore;

        return `${currentRank}: ${player.name} has **${
          player.pointsScore
        } point${player.pointsScore === 1 ? '' : 's'}** over ${
          player.games.length
        } game${player.games.length === 1 ? '' : 's'}.`;
      })
      .join('\n')
  );
}

async function weeklyLeaderboardStr(): Promise<string> {
  // # Leaderboard
  const players = await PlayerModel.find().sort({ weeklyPointsScore: -1 });

  if (players.length === 0) {
    return 'No players yet.';
  }
  let currentRank = 1;
  let playersInCurrentRank = 0;
  let previousWeeklyPointScore = 0;
  let isFirstPlayer = true;

  return (
    `**Wordle Weekly Leaderboard**\n` +
    players
      .map((player) => {
        if (
          player.weeklyPointsScore < previousWeeklyPointScore ||
          isFirstPlayer
        ) {
          currentRank = currentRank + playersInCurrentRank;
          playersInCurrentRank = 1;

          isFirstPlayer = false;
        } else if (player.weeklyPointsScore === previousWeeklyPointScore) {
          playersInCurrentRank++;
        }

        previousWeeklyPointScore = player.weeklyPointsScore;

        return `${currentRank}: ${player.name} has **${
          player.weeklyPointsScore
        } point${player.weeklyPointsScore === 1 ? '' : 's'}** this week over ${
          player.weeklyGamesPlayed
        } game${player.weeklyGamesPlayed === 1 ? '' : 's'}.`;
      })
      .join('\n')
  );
}

async function missingUserGames(interaction: CommandInteraction) {
  const wordleMeta = await WordleMetaModel.findOne();

  if (wordleMeta) {
    const player = await PlayerModel.findOne({ id: interaction.user.id });
    let playerMissingGames: Number[] = [];

    if (player) {
      // Find all of this week's games
      for (
        let wordleIndex = wordleMeta.weekStartWordleIndex;
        wordleIndex <= wordleMeta.weekStartWordleIndex + 6;
        wordleIndex++
      ) {
        if (!player.games.find((game) => game.wordleIndex === wordleIndex)) {
          playerMissingGames.push(wordleIndex);
        }
      }

      if (playerMissingGames.length > 0) {
        interaction.reply(
          `**Wordle Weekly Missing Games**\nYou are currently missing the following games this week.\n${playerMissingGames
            .map(
              (wordleGameIndex) =>
                `Wordle ${wordleGameIndex} - <https://minactle.herokuapp.com/?${wordleGameIndex}>`,
            )
            .join('\n')}`,
        );
      } else {
        interaction.reply('You are not missing any games this week.');
      }
    }
  }
}

async function parseWordle(firstLine: string, message: Message) {
  const authorId = message.author.id;
  const authorName = message.author.username;

  const wordleResultMatches = firstLine.match(WORDLE_RESULT_REGEX);

  // If Wordle
  if (wordleResultMatches) {
    // Parse Wordle
    const wordleIndex = Number.parseInt(
      wordleResultMatches.groups!.wordleIndex,
    );
    const isHardMode = wordleResultMatches.groups!.isHardMode === '*';
    const attempts = wordleResultMatches.groups!.attempts;

    const wordleMeta = await WordleMetaModel.findOne({});

    const player =
      (await PlayerModel.findOne({ id: authorId })) ||
      NewPlayerBuilder(authorId, authorName);

    if (
      !player.games.find((game) => game.wordleIndex === wordleIndex) &&
      wordleMeta
    ) {
      const game: GameImpl = {
        wordleIndex: wordleIndex,
        isHardMode: isHardMode,
        attempts: attempts === 'X' ? 7 : Number.parseInt(attempts),
      };

      // If attempts is "X", score 0 points
      const deltaPointsScore =
        attempts === 'X'
          ? 0
          : scoring[game.attempts - 1] +
            (game.isHardMode ? scoringHardMode : 0);

      player.pointsScore += deltaPointsScore;

      player.games.push(game);

      if (
        wordleIndex >= wordleMeta.weekStartWordleIndex &&
        wordleIndex <= wordleMeta.weekStartWordleIndex + 6
      ) {
        // If Wordle game is within the week
        // For timezone checks

        player.weeklyGamesPlayed += 1;
        player.weeklyPointsScore += deltaPointsScore;

        await message.channel.send(
          `<@${authorId}> - Wordle ${wordleIndex} added (+${deltaPointsScore} point${
            deltaPointsScore === 1 ? '' : 's'
          }). You now have **${player.weeklyPointsScore} points** this week.`,
        );
      } else if (wordleIndex > wordleMeta.weekStartWordleIndex + 6) {
        // Else if the wordle index is next weeks (for people in the next timezone)
        player.nextWeeklyPointsScore += deltaPointsScore;

        await message.channel.send(
          `<@${authorId}> - Wordle ${wordleIndex} added (+${deltaPointsScore} point${
            deltaPointsScore === 1 ? '' : 's'
          }). You now have **${
            player.nextWeeklyPointsScore
          } points** for the next week. You have **${
            player.weeklyPointsScore
          } points** this week.`,
        );
      } else {
        await message.channel.send(
          `<@${authorId}> - Wordle ${wordleIndex} added (+${deltaPointsScore} points). You now have **${
            player.pointsScore
          } points** over ${player.games.length} game${
            player.games.length === 1 ? '' : 's'
          }.`,
        );
      }

      await player.save();

      message.react(
        twiceReactionEmojiIds[
          Math.floor(Math.random() * twiceReactionEmojiIds.length)
        ],
      );
    } else {
      await message.channel.send(
        `<@${authorId}> - Wordle ${wordleIndex} already added.`,
      );
    }
  }
}

const cronDailyIncrement = (client: Client): CronJob =>
  createCronJob('0 0 0 * * *', 'Pacific/Kiritimati', async function () {
    const wordleMeta = await WordleMetaModel.findOne();

    if (wordleMeta) {
      wordleMeta.currentWordleIndex += 1;
      wordleMeta.save();
    }
  });

const cronWeeklyReminder = (client: Client): CronJob =>
  createCronJob('0 0 12 * * 1', 'Pacific/Kiritimati', async function () {
    const wordleMeta = await WordleMetaModel.findOne();

    if (wordleMeta) {
      let playerReminderMessages: string[] = [];

      const players = await PlayerModel.find();
      for (const player of players) {
        let playerMissingGames: Number[] = [];

        // Find all of this week's games
        for (
          let wordleIndex = wordleMeta.weekStartWordleIndex;
          wordleIndex <= wordleMeta.weekStartWordleIndex + 6;
          wordleIndex++
        ) {
          if (!player.games.find((game) => game.wordleIndex === wordleIndex)) {
            playerMissingGames.push(wordleIndex);
          }
        }

        if (playerMissingGames.length > 0) {
          playerReminderMessages.push(
            `<@${player.id}>\n${playerMissingGames
              .map(
                (wordleGameIndex) =>
                  `Wordle ${wordleGameIndex} - <https://minactle.herokuapp.com/?${wordleGameIndex}>`,
              )
              .join('\n')}`,
          );
        }
      }

      if (playerReminderMessages.length > 0) {
        WORDLE_CHANNEL.send(
          `**Wordle Weekly Reminder**\nYou have 12 hours to submit these missing games before weekly scores are calculated.\n\n` +
            playerReminderMessages.join('\n\n'),
        );
      }
    }
  });

const cronWeeklyReset = (client: Client): CronJob =>
  createCronJob('30 59 23 * * 1', 'Pacific/Kiritimati', async function () {
    const wordleMeta = await WordleMetaModel.findOne();
    if (wordleMeta) {
      wordleMeta.weekStartWordleIndex += 7;
      wordleMeta.save();
    }

    await WORDLE_CHANNEL.send(await weeklyLeaderboardStr());

    // Get the weekly top players
    const players = await PlayerModel.find().sort({ weeklyPointsScore: -1 });
    if (players.length === 0) {
      return;
    }

    const winningPlayers: PlayerImpl[] = [];
    winningPlayers.push(players[0]);

    const topWeeklyPointsScore = players[0].weeklyPointsScore;

    for (let playerIndex = 1; playerIndex < players.length; playerIndex++) {
      if (players[playerIndex].weeklyPointsScore === topWeeklyPointsScore) {
        winningPlayers.push(players[playerIndex]);
      } else {
        break;
      }
    }

    WORDLE_CHANNEL.send(
      `🎉 Congrats to ${winningPlayers
        .map((player) => player.name)
        .join(', ')} with ${topWeeklyPointsScore} point${
        topWeeklyPointsScore === 1 ? '' : 's'
      }! 🎉`,
    );

    // Reset everyone's weekly scores
    for (const player of players) {
      // If the next game exists, set to 1
      player.weeklyGamesPlayed = player.nextWeeklyPointsScore > 0 ? 1 : 0;

      // Set next week score (if no games played, set to 0 anyways)
      player.weeklyPointsScore = player.nextWeeklyPointsScore;
      player.nextWeeklyPointsScore = 0;

      player.save();
    }
  });

export default commandModule;
