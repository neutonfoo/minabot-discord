if (process.env.NODE_ENV !== "production") require("dotenv").config();

const prefix = "m!";

let dispatcher = null;
const currentPlaylist = [];

const fs = require("fs");

const ytdl = require("ytdl-core");
const yts = require("yt-search");

const Discord = require("discord.js");
const client = new Discord.Client();
client.commands = new Discord.Collection();

const commandFiles = fs
  .readdirSync("./commands")
  .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", async message => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Play is stateful so place here
  if (command === "play") {
    message.member.voice.channel.join().then(async connection => {
      let youtube_url = args.join(" ");

      if (
        !youtube_url.includes("youtu.be/") &&
        !youtube_url.includes("youtube.com/")
      ) {
        const youtube_search = await yts(youtube_url);
        youtube_url = youtube_search.videos[0].url;
      }

      currentPlaylist.push(youtube_url);

      if (!dispatcher) {
        const youtube_stream = await ytdl(currentPlaylist.pop(), {
          filter: "audioonly",
          quality: "highestaudio",
        });

        dispatcher = connection.play(youtube_stream);
      }

      dispatcher.on("finish", async () => {
        if (currentPlaylist.length > 0) {
          const youtube_stream = await ytdl(currentPlaylist.pop(), {
            filter: "audioonly",
            quality: "highestaudio",
          });

          dispatcher = connection.play(youtube_stream);
        } else {
          connection.disconnect();
          dispatcher = null;
        }
      });

      dispatcher.on("error", console.error);
    });
  }

  if (!client.commands.has(command)) return;

  try {
    client.commands.get(command).execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply("There was an error trying to execute that command!");
  }
});

// client.on("message", async msg => {
//   // if (msg.channel.id === process.env.DISCORD_CHANNEL_ID) {
//   if (msg.content.startsWith("!minaplay ")) {
//     const youtube_url = msg.content.substr(msg.content.indexOf(" ") + 1);

//     const can_play = await ytdl.getBasicInfo(youtube_url).then(res => {
//       if (res.videoDetails.title.toLowerCase().includes("nct")) return false;
//       return true;
//     });

//     if (!can_play) {
//       msg.channel.send(await getTenorGif("kpop no"));
//       return;
//     }

//     msg.member.voice.channel.join().then(async connection => {
//       const youtube_stream = await ytdl(youtube_url, {
//         filter: "audioonly",
//         quality: "highestaudio",
//       });

//       const dispatcher = connection.play(youtube_stream);

//       dispatcher.on("finish", () => {
//         connection.disconnect();
//         console.log("Finished playing!");
//       });

//       dispatcher.on("error", console.error);
//     });
//   } else if (msg.content.startsWith("!gif ")) {
//     const searchTerm = msg.content.substr(msg.content.indexOf(" ") + 1);
//     // console.log(searchTerm);
//     msg.channel.send(await getTenorGif(searchTerm));
//   } else if (msg.content === "!twice") {
//     msg.channel.send(await getTenorGif("twice"));
//   } else if (msg.content === "!mina") {
//     msg.channel.send(await getTenorGif("mina"));
//   } else if (msg.content === "!bts") {
//     msg.channel.send(await getTenorGif("nct"));
//   } else if (msg.content === "!nct") {
//     msg.channel.send(await getTenorGif("bts"));
//   } else if (msg.content === "!haechan") {
//     msg.channel.send(await getTenorGif("haechan"));
//   }

//   // }
// });

client.login(process.env.DISCORD_TOKEN);
