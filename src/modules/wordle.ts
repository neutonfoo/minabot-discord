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
        //   currentWordleIndex: 297,
        //   numberOfPlayers: 4,
        //   numberOfPlays: 0,
        //   streaks: [],
        // });
        // await wordleMeta.save();
        // (await cronGameChecker(client)).start();
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
            help(message.channel as TextChannel);
          } else if (
            commandParts[0] === "l" ||
            commandParts[0] === "leaderboard"
          ) {
            leaderboard(message.channel as TextChannel);
          } else if (commandParts[0] === "s" || commandParts[0] === "stats") {
          }

          // # Admin Commands
          if (authorId === process.env.ADMIN_DISCORD_ID) {
            // Validate
            if (commandParts[0] === "recalculate_points") {
              const liveWordleIndex = Number.parseInt(commandParts[1]);

              adminRecalculatePoints(liveWordleIndex);
              leaderboard(message.channel as TextChannel);
            }
          }
        }

        // If in Wordle channel
        if (channelId === WORDLE_CHANNEL_ID) {
          const firstLine = content.split(/\r?\n/)[0];
          parseWordle(firstLine, message);
        }
      },
    },
  ],
};

// async function cronGameChecker(client: Client): Promise<CronJob> {
//   return new CronJob(
//     "*/10 * * * * *",
//     // "59 23 * * *",
//     function () {
//       const channel = client.channels.cache.get(
//         WORDLE_CHANNEL_ID!
//       ) as TextChannel;
//       channel.send(`test ${Math.random()}`);
//     },
//     null,
//     false,
//     "America/Los_Angeles"
//   );
// }

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
        // `(Streaks are currently not automatically recalculated)\n` +
        // wordleMeta!.streaks
        //   .map(
        //     player =>
        //       `:fire: ${player.name} is on a streak of ${player.games} game${
        //         player.games === 1 ? "" : "s"
        //       } :fire: `
        //   )
        //   .join("\n") +
        // "\n\n" +
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
  // Get all the players
  const players = await Player.find();

  // Copy players so the game order isn't messed up
  const playersCopy: IPlayer[] = JSON.parse(JSON.stringify(players));

  // # Calculate pointsScore
  for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
    const player = players[playerIndex];

    // Sort player.games by Wordle Index desc for later
    playersCopy[playerIndex].games.sort(
      (game1, game2) => game2.wordleIndex - game1.wordleIndex
    );

    let pointsScore = 0;

    for (const game of player.games) {
      pointsScore += scoring[game.attempts - 1];
      if (game.isHardMode) pointsScore += scoringHardMode;
    }

    player.pointsScore = pointsScore;
    player.save();
  }

  // # Calculate roundsScore
  // const streakingPlayers: IPlayer[] = [];
  // for (const player of playersCopy) {
  //   player.currentStreak = 0;
  //   streakingPlayers.push(player);
  // }

  // for (let gameIndex = 0; gameIndex < liveWordleIndex; gameIndex++) {
  //   if (streakingPlayers.length === 0) break;

  //   const gameBestPlayers: IPlayer[] = [];
  //   let gameBestAttempts = 7; // This is the max/worst value

  //   // Loop through each player
  //   for (const [playerIndex, player] of streakingPlayers.entries()) {
  //     // If a game is not in sequence, set streak and continue
  //     if (player.games[gameIndex].wordleIndex != liveWordleIndex - gameIndex) {
  //       continue;
  //     } else if (player.games[gameIndex].attempts < gameBestAttempts) {
  //       gameBestAttempts = player.games[gameIndex].attempts;

  //       // Clear the existing array
  //       gameBestPlayers.length = 0;
  //       gameBestPlayers.push(player);
  //     } else if (player.games[gameIndex].attempts == gameBestAttempts) {
  //       gameBestPlayers.push(player);
  //     }
  //   }

  //   streakingPlayers.filter(player => gameBestPlayers.indexOf(player) > -1);
  // }

  // const longestPlayerGames = Math.max(
  //   ...playersCopy.map(({ games }) => games.length)
  // );

  // const latestMinAttempts = Math.min(
  //   ...playersCopy.map(({ games }) => games[0].attempts)
  // );
  // const latestStreakPlayers = playersCopy.filter(
  //   player => player.games[0].attempts === latestMinAttempts
  // );
  // latestStreakPlayers.forEach(player => {
  //   player.currentStreak = 1;
  //   player.isStreaking = true;
  // });

  // // Go down each game and add streaks
  // for (let gameIndex = 1; gameIndex < longestPlayerGames; gameIndex++) {
  //   const minAttempts = Math.min(
  //     ...playersCopy.map(({ games }) =>
  //       games[gameIndex] ? games[gameIndex].attempts : 7
  //     )
  //   );

  //   const streakPlayers = latestStreakPlayers.filter(player =>
  //     player.games[gameIndex]
  //       ? player.games[gameIndex].attempts === minAttempts
  //         ? player.isStreaking
  //         : (player.isStreaking = false && false)
  //       : (player.isStreaking = false && false)
  //   );

  //   for (const player of streakPlayers) {
  //     player.currentStreak++;
  //   }

  //   if (latestStreakPlayers.filter(player => player.isStreaking).length === 0) {
  //     break;
  //   }
  // }
  // const wordleMeta = await WordleMeta.findOne();

  // if (wordleMeta) {
  //   // for(const player of latestStreakPlayers) {
  //   wordleMeta.streaks = latestStreakPlayers.map(player => ({
  //     id: player.id,
  //     name: player.name,
  //     games: player.currentStreak,
  //   }));
  //   wordleMeta.save();
  // }
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

      player.games.push(game);

      await player.save();

      message.react(
        twiceReactionEmojiIds[
          Math.floor(Math.random() * twiceReactionEmojiIds.length)
        ]
      );

      await message.channel.send(
        `<@${authorId}> - Wordle game ${wordleIndex} added (+${deltaPointsScore} points). You now have **${player.pointsScore} points**.`
      );
    } else {
      await message.channel.send(
        `<@${authorId}> - Wordle game ${wordleIndex} already added.`
      );

      // const wordleMeta = await WordleMeta.findOne();
      // if (wordleMeta) {
      //   wordleMeta.numberOfPlays++;
      //   wordleMeta.save();

      //   if (wordleMeta.numberOfPlays === wordleMeta.numberOfPlayers) {
      //     checkRounds(wordleMeta.currentWordleIndex);
      //   }
      // }
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
