import { CronJob } from "cron";
import { Client, Message, TextChannel } from "discord.js";
import { connect } from "mongoose";
import { Game, IPlayer, Player, WordleMeta } from "./wordle.model";

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
  /^Wordle (?<wordleIndex>\d+) (?<attempts>[X|1-6])\/6(?<isHardMode>\*?)$/;

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
            commandParts[0] === "leaderboard"
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
    "America/Los_Angeles"
  );
}
async function cronWeeklyReset(client: Client): Promise<CronJob> {
  return new CronJob(
    // Every Monday
    "0 0 0 * * 1",
    async function () {
      const wordleMeta = await WordleMeta.findOne();
      if (wordleMeta) {
        wordleMeta.weekStartWordleIndex += 7;
        wordleMeta.save();
      }

      const players = await Player.find();
      for (const player of players) {
        player.weeklyPointsScore = 0;
        player.save();
      }

      leaderboard(client.channels.cache.get(WORDLE_CHANNEL_ID!) as TextChannel);
    },
    null,
    false,
    "America/Los_Angeles"
  );
}

async function help(channel: TextChannel) {
  let helpMessage = `**Wordle Tracker Help**\n`;
  helpMessage += `\`${prefix}h | help\`: Show this help message\n`;
  helpMessage += `\`${prefix}l | leaderboard\`: Show leaderboard\n`;
  helpMessage += `\`${prefix}s | stats\`: Show your stats\n`;
  helpMessage += `\`${prefix}s @user\`: Show stats for a specific user`;

  await channel.send(helpMessage);
}

async function leaderboard(channel: TextChannel) {
  // # Leaderboard
  const players = await Player.find().sort({ weeklyPointsScore: -1 });

  if (players.length === 0) {
    await channel.send("No players yet.");
  } else {
    let currentRank = 1;
    let playersInCurrentRank = 0;
    let previousWeeklyPointScore = 0;
    let isFirstPlayer = true;

    await channel.send(
      `**Wordle Leaderboard**\n` +
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
            } point${player.weeklyPointsScore === 1 ? "" : "s"}** this week. (${
              player.pointsScore
            } total points over ${player.games.length} games.)`;
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

    player.weeklyPointsScore = 0;

    for (const game of player.games) {
      let gameScore = scoring[game.attempts - 1];
      if (game.isHardMode) gameScore += scoringHardMode;

      pointsScore += gameScore;

      if (wordleMeta) {
        if (
          game.wordleIndex >= wordleMeta.weekStartWordleIndex &&
          game.wordleIndex <= wordleMeta.currentWordleIndex
        ) {
          player.weeklyPointsScore += gameScore;
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

    const player =
      (await Player.findOne({ id: authorId })) ||
      new Player({
        id: authorId,
        name: authorName,
        weeklyPointsScore: 0,
        pointsScore: 0,
        roundsScore: 0,
        longestStreak: 0,
        games: [],
      });

    if (!player.games.find(game => game.wordleIndex === wordleIndex)) {
      const game: Game = {
        wordleIndex: wordleIndex,
        isHardMode: isHardMode,
        attempts: attempts === "X" ? 7 : Number.parseInt(attempts),
      };

      const deltaPointsScore =
        scoring[game.attempts - 1] + (game.isHardMode ? scoringHardMode : 0);

      player.pointsScore += deltaPointsScore;
      player.weeklyPointsScore += deltaPointsScore;

      player.games.push(game);

      await player.save();

      message.react(
        twiceReactionEmojiIds[
          Math.floor(Math.random() * twiceReactionEmojiIds.length)
        ]
      );

      await message.channel.send(
        `<@${authorId}> - Wordle ${wordleIndex} added (+${deltaPointsScore} points). You now have **${player.pointsScore} points**.`
      );
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
