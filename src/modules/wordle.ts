import { CronJob } from "cron";
import { Client, Message, TextChannel } from "discord.js";
import { connect } from "mongoose";
import {
  Game,
  IPlayer,
  NewPlayerBuilder,
  Player,
  WordleMeta,
} from "./wordle.model";

if (process.env.NODE_ENV !== "production") require("dotenv").config();

// # Command Prefix
const prefix = "!w ";

// # Bot-Test-Private channel
const WORDLE_CHANNEL_ID = process.env.WORDLE_CHANNEL_ID;

// # MongoDB Connection String
const MONGODB_CONNECTION = `${process.env.MONGODB_BASE_CONNECTION}wordleTracker?retryWrites=true&w=majority`;

// # Scoring

// ## Extra points to award when played in hard mode (excluding failures)
const scoringHardMode = 1;
const scoring: number[] = [
  6, // 1 Attempt
  5, // 2 Attempts
  4, // 3 Attempts
  3, // 4 Attempts
  2, // 5 Attempts
  1, // 6 Attempts
  0, // 0 Attempts / Fail
];

// # Wordle result match Regex
const WORDLE_RESULT_REGEX =
  /^(Wordle|Reactle) (?<wordleIndex>\d+) (?<attempts>[X|1-6])\/6(?<isHardMode>\*?)$/;

// # Twice Reaction
const twiceReactionEmojiIds = [
  "812417222583517234",
  "813175312245850113",
  "813175312602628106",
  "813175312795828225",
  "813178058394566668",
  "813175312552689674",
  "813175312246243359",
  "813175311813836801",
  "813175312766468136",
];

module.exports = {
  events: [
    {
      name: "ready",
      async execute(client: Client) {
        await connect(MONGODB_CONNECTION);

        // ###
        // ### IMPORTANT: THIS IS ONLY RUN ONCE TO GENERATE INITIAL CONFIG FILE
        // ###

        // const wordleMeta = new WordleMeta({
        //   currentWordleIndex: 334,
        //   weekStartWordleIndex: 331,
        //   numberOfPlayers: 5,
        //   numberOfPlays: 0,
        //   streaks: [],
        // });
        // await wordleMeta.save();
        (await cronDailyIncrement(client)).start();
        (await cronWeeklyReset(client)).start();
        (await cronWeeklyReminder(client)).start();
      },
    },
    {
      name: "messageCreate",
      async execute(message: Message) {
        if (message.author.bot) return false;

        // Get message info
        const content = message.content;
        const channelId = message.channelId;
        const authorId = message.author.id;
        // const authorName = message.author.username;

        // Global commands
        if (content.startsWith(prefix)) {
          const commandParts = content.substring(prefix.length).split(" ");

          if (commandParts[0] === "h" || commandParts[0] === "help") {
            await help(message.channel as TextChannel);
          } else if (
            commandParts[0] === "l" ||
            commandParts[0] === "weeklyLeaderboard"
          ) {
            await weeklyLeaderboard(message.channel as TextChannel);
          } else if (
            commandParts[0] === "lt" ||
            commandParts[0] === "leaderboardTotal"
          ) {
            await leaderboard(message.channel as TextChannel);
          } else if (commandParts[0] === "s" || commandParts[0] === "stats") {
          }

          // # Admin Commands
          if (authorId === process.env.ADMIN_DISCORD_ID) {
            // Validate
            if (commandParts[0] === "recalculate_points") {
              const liveWordleIndex = Number.parseInt(commandParts[1]);

              await adminRecalculatePoints(liveWordleIndex);
              await leaderboard(message.channel as TextChannel);
            }
          }
        }

        // If in Wordle channel
        if (channelId === WORDLE_CHANNEL_ID) {
          const firstLine = content.split(/\r?\n/)[0];
          await parseWordle(firstLine, message);
        }
      },
    },
  ],
};

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
        const wordle_channel = client.channels.cache.get(
          WORDLE_CHANNEL_ID!
        ) as TextChannel;

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
              `<@${player.id}> - Missing games(s) ${playerMissingGames.join(
                ", "
              )}.`
            );
          }
        }

        if (playerReminderMessages.length > 0) {
          wordle_channel.send(
            `**Wordle Weekly Reminder**\nYou have 12 hours to submit these missing games\n` +
              playerReminderMessages.join("\n")
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
    // Every start of Tuesday (ie End of Monday in all timezones)
    "0 0 0 * * 2",
    async function () {
      const wordleMeta = await WordleMeta.findOne();
      if (wordleMeta) {
        wordleMeta.weekStartWordleIndex += 7;
        wordleMeta.save();
      }

      const wordle_channel = client.channels.cache.get(
        WORDLE_CHANNEL_ID!
      ) as TextChannel;

      let firstPlayer = await weeklyLeaderboard(wordle_channel);

      wordle_channel.send(`Congrats to **${firstPlayer.name}**!`);

      const players = await Player.find();
      for (const player of players) {
        // Set next week score (if no games played, set to 0 anyways)
        player.weeklyPointsScore = player.nextWeeklyPointsScore;
        player.nextWeeklyPointsScore = 0;

        // If the next game exists, set to 1
        player.weeklyGamesPlayed = player.games.filter(
          game => game.wordleIndex === wordleMeta?.weekStartWordleIndex
        )
          ? 1
          : 0;
        player.save();
      }
    },
    null,
    false,
    "Pacific/Kiritimati"
  );
}

async function help(channel: TextChannel) {
  let helpMessage = `**Wordle Tracker Help**\n`;
  helpMessage += `\`${prefix}h | help\`: Show this help message\n`;
  helpMessage += `\`${prefix}l | weeklyLeaderboard\`: Show weeklyLeaderboard\n`;
  helpMessage += `\`${prefix}s | stats\`: Show your stats\n`;
  helpMessage += `\`${prefix}s @user\`: Show stats for a specific user`;

  await channel.send(helpMessage);
}

async function weeklyLeaderboard(channel: TextChannel) {
  // # Leaderboard
  const players = await Player.find().sort({ weeklyPointsScore: -1 });
  let firstPlayer: IPlayer;

  if (players.length === 0) {
    await channel.send("No players yet.");
  } else {
    let currentRank = 1;
    let playersInCurrentRank = 0;
    let previousWeeklyPointScore = 0;

    await channel.send(
      `**Wordle Leaderboard**\n` +
        players
          .map(player => {
            if (
              player.weeklyPointsScore < previousWeeklyPointScore ||
              !firstPlayer
            ) {
              currentRank = currentRank + playersInCurrentRank;
              playersInCurrentRank = 1;

              if (!firstPlayer) {
                firstPlayer = player;
              }
            } else if (player.weeklyPointsScore === previousWeeklyPointScore) {
              playersInCurrentRank++;
            }

            previousWeeklyPointScore = player.weeklyPointsScore;

            return `${currentRank}: ${player.name} has **${
              player.weeklyPointsScore
            } point${
              player.weeklyPointsScore === 1 ? "" : "s"
            }** this week over ${player.weeklyGamesPlayed} game${
              player.weeklyGamesPlayed === 1 ? "" : "s"
            }.`;
          })
          .join("\n")
    );
  }

  return firstPlayer!;
}

async function leaderboard(channel: TextChannel) {
  // # Leaderboard
  const players = await Player.find().sort({ pointsScore: -1 });

  if (players.length === 0) {
    await channel.send("No players yet.");
  } else {
    let currentRank = 1;
    let playersInCurrentRank = 0;
    let previousPointScore = 0;
    let isFirstPlayer = true;

    const wordleMeta = await WordleMeta.findOne();

    await channel.send(
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
}

async function adminRecalculatePoints(liveWordleIndex: number) {
  // Get the Wordle Meta (for weekly score calculation)
  const wordleMeta = await WordleMeta.findOne({});

  // Get all the players
  const players = await Player.find();

  // Copy players so the game order isn't messed up
  const playersCopy: IPlayer[] = JSON.parse(JSON.stringify(players));

  // # Calculate pointsScore
  for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
    // Get the actual player
    const player = players[playerIndex];

    // Sort player.games by Wordle Index desc for later
    playersCopy[playerIndex].games.sort(
      (game1, game2) => game2.wordleIndex - game1.wordleIndex
    );

    let pointsScore = 0;

    player.weeklyGamesPlayed = 0;
    player.weeklyPointsScore = 0;

    for (const game of player.games) {
      let gameScore = scoring[game.attempts - 1];
      if (game.isHardMode) gameScore += scoringHardMode;

      pointsScore += gameScore;

      if (wordleMeta) {
        if (
          game.wordleIndex >= wordleMeta.weekStartWordleIndex &&
          game.wordleIndex <= wordleMeta.weekStartWordleIndex + 6
        ) {
          player.weeklyGamesPlayed += 1;
          player.weeklyPointsScore += gameScore;
        } else if (game.wordleIndex > wordleMeta.weekStartWordleIndex + 6) {
          player.nextWeeklyPointsScore += gameScore;
        }
      }
    }

    player.pointsScore = pointsScore;
    player.save();
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

      const deltaPointsScore =
        scoring[game.attempts - 1] + (game.isHardMode ? scoringHardMode : 0);

      player.pointsScore += deltaPointsScore;

      if (wordleIndex <= wordleMeta.weekStartWordleIndex + 6) {
        // If Wordle game is within the week
        // For timezone checks

        player.weeklyGamesPlayed += 1;
        player.weeklyPointsScore += deltaPointsScore;
      } else if (wordleIndex > wordleMeta.weekStartWordleIndex + 6) {
        // Else if the wordle index is next weeks (for people in the next timezone)
        player.nextWeeklyPointsScore += deltaPointsScore;
      }

      player.games.push(game);

      await player.save();

      message.react(
        twiceReactionEmojiIds[
          Math.floor(Math.random() * twiceReactionEmojiIds.length)
        ]
      );

      await message.channel.send(
        `<@${authorId}> - Wordle ${wordleIndex} added (+${deltaPointsScore} point${
          deltaPointsScore === 1 ? "" : "s"
        }). You now have **${player.weeklyPointsScore} points** this week.`
      );

      // await message.channel.send(
      //   `<@${authorId}> - Wordle ${wordleIndex} added (+${deltaPointsScore} points). You now have **${player.pointsScore} points**.`
      // );
    } else {
      await message.channel.send(
        `<@${authorId}> - Wordle ${wordleIndex} already added.`
      );
    }
  }
}

async function checkRounds(currentWordleIndex: number) {
  // Check Rounds
  const players = await Player.find();

  // const currentGames =

  // const minAttempts = Math.min(
  //   ...players.map(({ games }) =>
  //     games[gameIndex] ? games[gameIndex].attempts : 7
  //   )
  // );

  // const streakPlayers = latestStreakPlayers.filter(player =>
  //   player.games[gameIndex]
  //     ? player.games[gameIndex].attempts === minAttempts
  //       ? player.isStreaking
  //       : (player.isStreaking = false && false)
  //     : (player.isStreaking = false && false)
  // );

  // for (const player of streakPlayers) {
  //   player.currentStreak++;
  // }
}
