import { Message } from "discord.js";

import CryptoJS from "crypto-js";
import youtubeDlExec from "youtube-dl-exec";

const prefix = "!dl ";
const savedVideoPrefix = "youtubedl_";

module.exports = {
  events: [
    {
      name: "messageCreate",
      async execute(message: Message) {
        if (message.author.bot) return false;

        const content = message.content;

        if (content.startsWith(prefix)) {
          const commandParts = content.substring(prefix.length).split(" ");

          const youtubeVideoUrl = commandParts[0];

          const savedVideoPath = `~/app/${savedVideoPrefix}${CryptoJS.MD5(
            youtubeVideoUrl
          )}.mp4`;

          await message.react("🐧");

          const output = await youtubeDlExec(youtubeVideoUrl, {
            output: savedVideoPath,
          });

          message.reply(savedVideoPath);
          message.reply(`${output}`);
        }
      },
    },
  ],
};
