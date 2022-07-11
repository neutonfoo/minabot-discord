import { SlashCommandBuilder } from "@discordjs/builders";
import { CronJob } from "cron";
import {
  CacheType,
  Client,
  CommandInteraction,
  Message,
  TextChannel,
} from "discord.js";
import { connect } from "mongoose";

import { IBotCommand, IBotEvent, IBotModule } from "../interfaces/BotModule";
import { twiceReactionEmojiIds } from "../util";
import {
  Game,
  IPlayer,
  NewPlayerBuilder,
  Player,
  WordleMeta,
} from "./wordle.model";

const BOT_MODULE_NAME = "Wordle";
const BOT_MODULE_COMMAND_NAME = "wordle";

const MONGODB_URI = process.env.MONGODB_URI!;
const WORDLE_CHANNEL_ID = process.env.WORDLE_CHANNEL_ID!;
let WORDLE_CHANNEL: TextChannel;

const MONGODB_CONNECTION = `${MONGODB_URI}/wordleTracker?retryWrites=true&w=majority`;

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

enum SUBCOMMAND_NAMES {
  REMINDER = "reminder",
  WEEKLY_LEADERBOARD = "leaderboard",
  LIFETIME_LEADERBOARD = "leaderboard_lifetime",
}

const COMMANDS: IBotCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName(BOT_MODULE_COMMAND_NAME)
      .setDescription(`[${BOT_MODULE_NAME}] module`)
      .addSubcommand(subcommand =>
        subcommand
          .setName(SUBCOMMAND_NAMES.REMINDER)
          .setDescription(`[${BOT_MODULE_NAME}] Reminds you of your games`)
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName(SUBCOMMAND_NAMES.LIFETIME_LEADERBOARD)
          .setDescription(`[${BOT_MODULE_NAME}] Show the lifetime leaderboard`)
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName(SUBCOMMAND_NAMES.WEEKLY_LEADERBOARD)
          .setDescription(`[${BOT_MODULE_NAME}] Show the weekly leaderboard`)
      ),

    execute: async interaction => {
      if (
        interaction.options.getSubcommand() ===
        SUBCOMMAND_NAMES.LIFETIME_LEADERBOARD
      ) {
        interaction.reply(await leaderboardStr());
      } else if (
        interaction.options.getSubcommand() ===
        SUBCOMMAND_NAMES.WEEKLY_LEADERBOARD
      ) {
        await interaction.reply(await weeklyLeaderboardStr());
      } else if (
        interaction.options.getSubcommand() === SUBCOMMAND_NAMES.REMINDER
      ) {
        await missingUserGames(interaction);
      }
    },
  },
];

const EVENTS: IBotEvent[] = [
  {
    event_name: "ready",
    execute: async (client: Client) => {
      WORDLE_CHANNEL = client.channels.cache.get(
        WORDLE_CHANNEL_ID
      ) as TextChannel;

      await connect(MONGODB_CONNECTION);

      (await cronDailyIncrement(client)).start();
      (await cronWeeklyReminder(client)).start();
      (await cronWeeklyReset(client)).start();
    },
  },
  {
    event_name: "messageCreate",
    execute: async (message: Message) => {
      if (message.author.bot) return false;

      if (message.channelId === WORDLE_CHANNEL_ID) {
        const firstLine = message.content.split(/\r?\n/)[0];
        await parseWordle(firstLine, message);
      }
    },
  },
];

async function cronDailyIncrement(client: Client): Promise<CronJob> {
  return new CronJob(
    // Everyday on 00:00
    "0 0 0 * * *",
    async function () {
      const wordleMeta = await WordleMeta.findOne();

      if (wordleMeta) {
        wordleMeta.currentWordleIndex += 1;
        wordleMeta.save();
      }
    },
    null,
    false,
    "Pacific/Kiritimati"
  );
}

async function cronWeeklyReminder(client: Client): Promise<CronJob> {
  return new CronJob(
    // Every 12:00pm Monday (12 hours before reset)
    "0 0 12 * * 1",
    async function () {
      const wordleMeta = await WordleMeta.findOne();

      if (wordleMeta) {
        let playerReminderMessages: string[] = [];

        const players = await Player.find();
        for (const player of players) {
          let playerMissingGames: Number[] = [];

          // Find all of this week's games
          for (
            let wordleIndex = wordleMeta.weekStartWordleIndex;
            wordleIndex <= wordleMeta.weekStartWordleIndex + 6;
            wordleIndex++
          ) {
            if (!player.games.find(game => game.wordleIndex === wordleIndex)) {
              playerMissingGames.push(wordleIndex);
            }
          }

          if (playerMissingGames.length > 0) {
            playerReminderMessages.push(
              `<@${player.id}>\n${playerMissingGames
                .map(
                  wordleGameIndex =>
                    `Wordle ${wordleGameIndex} - <https://minactle.herokuapp.com/?${wordleGameIndex}>`
                )
                .join("\n")}`
            );
          }
        }

        if (playerReminderMessages.length > 0) {
          WORDLE_CHANNEL.send(
            `**Wordle Weekly Reminder**\nYou have 12 hours to submit these missing games before weekly scores are calculated.\n\n` +
              playerReminderMessages.join("\n\n")
          );
        }
      }
    },
    null,
    false,
    "Pacific/Kiritimati"
  );
}

async function cronWeeklyReset(client: Client): Promise<CronJob> {
  return new CronJob(
    // At 23:59:30 on global Monday nights (just before Tuesday on the earliest timezone)
    "30 59 23 * * 1",
    async function () {
      const wordleMeta = await WordleMeta.findOne();
      if (wordleMeta) {
        wordleMeta.weekStartWordleIndex += 7;
        wordleMeta.save();
      }

      await WORDLE_CHANNEL.send(await weeklyLeaderboardStr());

      // Get the weekly top players
      const players = await Player.find().sort({ weeklyPointsScore: -1 });
      if (players.length === 0) {
        return;
      }

      const winningPlayers: IPlayer[] = [];
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
          .map(player => player.name)
          .join(", ")} with ${topWeeklyPointsScore} point${
          topWeeklyPointsScore === 1 ? "" : "s"
        }! 🎉`
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
    },
    null,
    false,
    "Pacific/Kiritimati"
  );
}

async function leaderboardStr(): Promise<string> {
  // # Leaderboard
  const players = await Player.find().sort({ pointsScore: -1 });

  if (players.length === 0) {
    return "No players yet.";
  }

  let currentRank = 1;
  let playersInCurrentRank = 0;
  let previousPointScore = 0;
  let isFirstPlayer = true;

  return (
    `**Wordle Leaderboard**\n` +
    players
      .map(player => {
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
        } point${player.pointsScore === 1 ? "" : "s"}** over ${
          player.games.length
        } game${player.games.length === 1 ? "" : "s"}.`;
      })
      .join("\n")
  );
}

async function weeklyLeaderboardStr(): Promise<string> {
  // # Leaderboard
  const players = await Player.find().sort({ weeklyPointsScore: -1 });

  if (players.length === 0) {
    return "No players yet.";
  }
  let currentRank = 1;
  let playersInCurrentRank = 0;
  let previousWeeklyPointScore = 0;
  let isFirstPlayer = true;

  return (
    `**Wordle Weekly Leaderboard**\n` +
    players
      .map(player => {
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
        } point${player.weeklyPointsScore === 1 ? "" : "s"}** this week over ${
          player.weeklyGamesPlayed
        } game${player.weeklyGamesPlayed === 1 ? "" : "s"}.`;
      })
      .join("\n")
  );
}

async function missingUserGames(interaction: CommandInteraction<CacheType>) {
  const wordleMeta = await WordleMeta.findOne();

  if (wordleMeta) {
    const player = await Player.findOne({ id: interaction.user.id });
    let playerMissingGames: Number[] = [];

    if (player) {
      // Find all of this week's games
      for (
        let wordleIndex = wordleMeta.weekStartWordleIndex;
        wordleIndex <= wordleMeta.weekStartWordleIndex + 6;
        wordleIndex++
      ) {
        if (!player.games.find(game => game.wordleIndex === wordleIndex)) {
          playerMissingGames.push(wordleIndex);
        }
      }

      if (playerMissingGames.length > 0) {
        interaction.reply(
          `**Wordle Weekly Missing Games**\nYou are currently missing the following games this week.\n${playerMissingGames
            .map(
              wordleGameIndex =>
                `Wordle ${wordleGameIndex} - <https://minactle.herokuapp.com/?${wordleGameIndex}>`
            )
            .join("\n")}`
        );
      } else {
        interaction.reply("You are not missing any games this week.");
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
      wordleResultMatches.groups!.wordleIndex
    );
    const isHardMode = wordleResultMatches.groups!.isHardMode === "*";
    const attempts = wordleResultMatches.groups!.attempts;

    const wordleMeta = await WordleMeta.findOne({});

    const player =
      (await Player.findOne({ id: authorId })) ||
      NewPlayerBuilder(authorId, authorName);

    if (
      !player.games.find(game => game.wordleIndex === wordleIndex) &&
      wordleMeta
    ) {
      const game: Game = {
        wordleIndex: wordleIndex,
        isHardMode: isHardMode,
        attempts: attempts === "X" ? 7 : Number.parseInt(attempts),
      };

      // If attempts is "X", score 0 points
      const deltaPointsScore =
        attempts === "X"
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
            deltaPointsScore === 1 ? "" : "s"
          }). You now have **${player.weeklyPointsScore} points** this week.`
        );
      } else if (wordleIndex > wordleMeta.weekStartWordleIndex + 6) {
        // Else if the wordle index is next weeks (for people in the next timezone)
        player.nextWeeklyPointsScore += deltaPointsScore;

        await message.channel.send(
          `<@${authorId}> - Wordle ${wordleIndex} added (+${deltaPointsScore} point${
            deltaPointsScore === 1 ? "" : "s"
          }). You now have **${
            player.nextWeeklyPointsScore
          } points** for the next week. You have **${
            player.weeklyPointsScore
          } points** this week.`
        );
      } else {
        await message.channel.send(
          `<@${authorId}> - Wordle ${wordleIndex} added (+${deltaPointsScore} points). You now have **${
            player.pointsScore
          } points** over ${player.games.length} game${
            player.games.length === 1 ? "" : "s"
          }.`
        );
      }

      await player.save();

      message.react(
        twiceReactionEmojiIds[
          Math.floor(Math.random() * twiceReactionEmojiIds.length)
        ]
      );
    } else {
      await message.channel.send(
        `<@${authorId}> - Wordle ${wordleIndex} already added.`
      );
    }
  }
}

module.exports = {
  bot_module_name: BOT_MODULE_NAME,
  commands: COMMANDS,
  events: EVENTS,
} as IBotModule;
