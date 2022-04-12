import { Client, Intents, TextChannel } from "discord.js";

if (process.env.NODE_ENV !== "production") require("dotenv").config();

const DISCORD_BOT_MODULES = ["./modules/ping", "./modules/wordle"];

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const client: Client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

client.on("ready", () => {
  if (client.user) {
    console.log(`Logged in as ${client.user.tag}!`);
  }

  // const channel = client.channels.cache.get(
  //   "950951957575655504"
  // ) as TextChannel;
  // channel.send("https://c.tenor.com/0k5X4YWnYdMAAAAM/mina-twice.gif");
});

for (const DISCORD_BOT_MODULE of DISCORD_BOT_MODULES.map(DISCORD_BOT_MODULE =>
  require(DISCORD_BOT_MODULE)
)) {
  // const DISCORD_BOT_MODULE = require(DISCORD_BOT_MODULE_FILENAME);

  for (const event of DISCORD_BOT_MODULE.events) {
    client.on(event.name, (...args: String[]) => {
      try {
        event.execute(...args);
      } catch (err) {
        err ? console.log(err) : console.log("Undefined error");
      }
    });
  }
}

client.login(DISCORD_BOT_TOKEN);
