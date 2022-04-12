import { Message } from "discord.js";

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
      name: "messageCreate",
      execute(message: Message) {
        if (message.author.bot) return false;

        // Get message info
        // const content = message.content;
        // const channelId = message.channelId;
        // const authorId = message.author.id;
        // const authorName = message.author.username;

        // if (channelId === "950951957575655504") {
        //   if (Math.random() < 0.25) {
        //     message.react(
        //       twiceReactionEmojiIds[
        //         Math.floor(Math.random() * twiceReactionEmojiIds.length)
        //       ]
        //     );
        //   }
        // }
      },
    },
  ],
};
