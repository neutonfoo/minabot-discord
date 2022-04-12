import { Client, Message } from "discord.js";
import { connect } from "mongoose";
import { IPlayer, Player } from "./wordle.model";

if (process.env.NODE_ENV !== "production") require("dotenv").config();

// First Wordle = 19 June 2021;

// # Command Prefix
const prefix = "!w ";

// # Bot-Test-Private channel
const WORDLE_CHANNEL_ID = process.env.WORDLE_CHANNEL_ID;

// # MongoDB Connection String
let hasConnectedToMongoDB = false;
const MONGODB_CONNECTION = `${process.env.MONGODB_BASE_CONNECTION}wordleTracker?retryWrites=true&w=majority`;

// # Scoring

// ## Extra points to award when played in hard mode (excluding failures)
const scoringHardMode = 1;
const scoring: number[] = [
  0, // 0 Attempts / Fail
  6, // 1 Attempt
  5, // 2 Attempts
  4, // 3 Attempts
  3, // 4 Attempts
  2, // 5 Attempts
  1, // 6 Attempts
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
        // const channel = client.channels.cache.get(
        //   WORDLE_CHANNEL_ID!
        // ) as TextChannel;
        // for (const twiceEmote of twiceReactionEmojiIds) {
        //   const someEmoji = client.emojis.cache.get(twiceEmote);
        //   if (someEmoji) {
        //     channel.send(someEmoji.toString());
        //   }
        // }
      },
    },
    {
      name: "messageCreate",
      async execute(message: Message) {
        if (message.author.bot) return false;

        if (!hasConnectedToMongoDB) {
          await connect(MONGODB_CONNECTION);
          hasConnectedToMongoDB = true;
        }

        // Get message info
        const content = message.content;
        const channelId = message.channelId;
        const authorId = message.author.id;
        const authorName = message.author.username;

        // Global commands
        if (content.startsWith(prefix)) {
          const commandParts = content.substring(prefix.length).split(" ");

          // console.log(commandParts);

          if (commandParts[0] === "h" || commandParts[0] === "help") {
            let helpMessage = `**Wordle Tracker Help**\n`;
            helpMessage += `\`${prefix}h | help\`: Show this help message\n`;
            helpMessage += `\`${prefix}l | leaderboard\`: Show leaderboard\n`;
            helpMessage += `\`${prefix}s | stats\`: Show your stats\n`;
            helpMessage += `\`${prefix}s @user\`: Show stats for a specific user`;

            await message.channel.send(helpMessage);
          } else if (
            commandParts[0] === "l" ||
            commandParts[0] === "leaderboard"
          ) {
            // # Leaderboard
            const playersClean: IPlayer[] = [];

            const players = await Player.find();
            for (const player of players) {
              let totalScore = 0;

              for (const game of player.games) {
                // If attempts > 0 -> they did not fail
                if (game.attempts > 0) {
                  totalScore += scoring[game.attempts];

                  if (game.isHardMode) totalScore += scoringHardMode;
                }
              }

              playersClean.push({
                id: player.id,
                name: player.name,
                totalScore: totalScore,
                games: player.games,
              });
            }

            // Sort by totalScore descending
            playersClean.sort(
              (player1, player2) => player2.totalScore - player1.totalScore
            );

            if (playersClean.length === 0) {
              await message.channel.send("No players yet.");
            } else {
              await message.channel.send(
                "**Wordle Leaderboard**\n" +
                  playersClean
                    .map(
                      (player, playerIndex) =>
                        `${playerIndex + 1}: ${player.name} has **${
                          player.totalScore
                        } point${player.totalScore === 1 ? "" : "s"}** over ${
                          player.games.length
                        } game${player.games.length === 1 ? "" : "s"}.`
                    )
                    .join("\n")
              );
            }
          } else if (commandParts[0] === "s" || commandParts[0] === "stats") {
            const statsUserId = commandParts[1]
              ? commandParts[1].substring(2, commandParts[1].length - 1)
              : authorId;

            const player = await Player.findOne({ id: statsUserId });

            if (player) {
              let statsMessage = `**${player.name} Wordle Stats**\n`;

              player.games.sort(
                (game1, game2) => game1.wordleIndex - game2.wordleIndex
              );

              for (let attempts = 0; attempts <= 6; attempts++) {
                const gamesAtAttempt = player.games.filter(
                  game => game.attempts === attempts
                );

                statsMessage += `**${attempts === 0 ? "X" : attempts}** *(${
                  gamesAtAttempt.length
                } game${gamesAtAttempt.length === 1 ? "" : "s"})*: ${
                  gamesAtAttempt.length === 0
                    ? "None"
                    : gamesAtAttempt
                        .map(
                          game =>
                            `${game.wordleIndex}${
                              game.isHardMode ? `\\\*` : ""
                            }`
                        )
                        .join(", ")
                }\n`;
              }

              await message.channel.send(statsMessage);
            } else {
              await message.channel.send(
                `<@${statsUserId}> is not playing Wordle.`
              );
            }
          }

          // else if (command === "lv") {
          //   // # Leaderboard (Verbose)

          //   const players = await Player.find();
          //   for (const player of players) {
          //     let totalScore = 0;

          //     for (const game of player.games) {
          //       // If attempts > 0, or if they did not fail
          //       if (game.attempts > 0) {
          //         totalScore += scoring[game.attempts];

          //         if (game.isHardMode) totalScore += scoringHardMode;
          //       }
          //     }

          //     playersClean.push({
          //       id: player.id,
          //       name: player.name,
          //       totalScore: totalScore,
          //       games: player.games,
          //     });
          //   }

          //   playersClean.sort(player => player.totalScore);

          //   if (playersClean.length === 0) {
          //     await message.channel.send("No players yet.");
          //   } else {
          //     await message.channel.send(
          //       playersClean
          //         .map((player, playerIndex) => {
          //           const positionLine = `${playerIndex + 1}: ${
          //             player.name
          //           } has **${player.totalScore} point${
          //             player.totalScore === 1 ? "" : "s"
          //           }** over ${player.games.length} game${
          //             player.games.length === 1 ? "" : "s"
          //           }.`;

          //           let history = `\t\t**:regional_indicator_x: ** ${
          //             player.games.filter(game => game.attempts === 0).length
          //           } games`;

          //           history += `\t**:one:** ${
          //             player.games.filter(game => game.attempts === 1).length
          //           } games`;

          //           history += `\t**:two:** ${
          //             player.games.filter(game => game.attempts === 2).length
          //           } games`;

          //           history += `\t**:three:** ${
          //             player.games.filter(game => game.attempts === 3).length
          //           } games`;

          //           history += `\t**:four:** ${
          //             player.games.filter(game => game.attempts === 4).length
          //           } games`;

          //           history += `\t**:five:** ${
          //             player.games.filter(game => game.attempts === 5).length
          //           } games`;

          //           history += `\t**:six:** ${
          //             player.games.filter(game => game.attempts === 6).length
          //           } games`;

          //           return `${positionLine}\n${history}`;
          //         })
          //         .join("\n")
          //     );
          //   }
          // }
        }

        // If in Wordle channel
        if (channelId === WORDLE_CHANNEL_ID) {
          const firstLine = content.split(/\r?\n/)[0];

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
              new Player({ id: authorId, name: authorName, games: [] });

            if (!player.games.find(game => game.wordleIndex === wordleIndex)) {
              player.games.push({
                wordleIndex: wordleIndex,
                isHardMode: isHardMode,
                attempts: attempts === "X" ? 0 : Number.parseInt(attempts),
              });

              await player.save();

              message.react(
                twiceReactionEmojiIds[
                  Math.floor(Math.random() * twiceReactionEmojiIds.length)
                ]
              );

              let totalScore = 0;

              for (const game of player.games) {
                // If attempts > 0, or if they did not fail
                if (game.attempts > 0) {
                  totalScore += scoring[game.attempts];

                  if (game.isHardMode) totalScore += scoringHardMode;
                }
              }

              await message.channel.send(
                `<@${authorId}> - Wordle game ${wordleIndex} added (+${
                  attempts === "X"
                    ? "0"
                    : isHardMode
                    ? scoring[Number.parseInt(attempts)] +
                      scoringHardMode +
                      `\\\*`
                    : scoring[Number.parseInt(attempts)]
                } points). You now have **${totalScore} points**.`
              );
            } else {
              await message.channel.send(
                `<@${authorId}> - Wordle game ${wordleIndex} already added.`
              );
            }
          }
        }
      },
    },
  ],
};
