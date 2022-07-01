import {
  Client,
  GuildMember,
  Message,
  Presence,
  TextChannel,
  User,
} from "discord.js";

const STREAMING_STATUS_CHANNEL_ID = process.env.STREAMING_STATUS_CHANNEL_ID!;

let c: Client;

module.exports = {
  events: [
    {
      name: "ready",
      async execute(client: Client) {
        c = client;
      },
    },
    {
      name: "messageCreate",
      execute(message: Message) {
        if (message.author.bot) return false;
      },
    },
    {
      name: "presenceUpdate",
      execute(oldPresence: Presence, newPresence: Presence) {
        const streaming_status_channel = c.channels.cache.get(
          STREAMING_STATUS_CHANNEL_ID
        ) as TextChannel;

        // streaming_status_channel.send(`${JSON.stringify(newMember)}`);
        console.log(newPresence);
        streaming_status_channel.send(
          `${newPresence.userId} - ${newPresence.status}`
        );
        // console.log(newPresence.userId);
      },
    },
  ],
};
