if (process.env.NODE_ENV !== "production") require("dotenv").config();

const prefix = "!";

const fs = require("fs");

const Discord = require("discord.js");
const client = new Discord.Client();
client.commands = new Discord.Collection();

const findahaiku = require("findahaiku");
const haikuReplacements = {
  shldve: "should've",
  rly: "really",
  lmk: "let me know",
  rip: "rest in peace",
  ty: "thank you",
  tysm: "thank you so much",
  tyvm: "thank you very much",
  tbh: "to be honest",
  ikr: "i know right",
  lol: "laughing out loud",
  icb: "i can't believe",
  lmao: "laughing my ass off",
  exp: "expensive",
  fr: "for real",
  gna: "gonna",
  omfg: "oh my fucking god",
  omg: "oh my god",
  ig: "i guess",
  idk: "i don't know",
  idc: "i don't care",
  idrc: "i don't really care",
  idm: "i don't mind",
  wtf: "what the fuck",
  bc: "because",
};

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
  // Custom detects
  if (
    message.content.startsWith("!play") &&
    message.content.toLowerCase().includes("nct")
  ) {
    const nayeon = message.guild.emojis.cache.find(
      emoji => emoji.name === "nayeon"
    );
    return message.react(nayeon);
  }

  // Haiku detector
  let haiku = message.content;
  for (const [needle, replacement] of Object.entries(haikuReplacements)) {
    if (haiku.startsWith(`${needle} `))
      haiku = haiku.replace(new RegExp("^" + needle), replacement);

    if (haiku.endsWith(` ${needle}`))
      haiku = haiku.replace(new RegExp(needle + "$"), replacement);

    haiku = haiku.replace(new RegExp(` ${needle} `, "g"), ` ${replacement} `);
  }
  const { isHaiku, formattedHaiku } = findahaiku.analyzeText(haiku);

  if (isHaiku) {
    const haikuEmbed = new Discord.MessageEmbed()
      .setColor("#0099ff")
      .setTitle(`A Haiku`)
      .setDescription(`*${formattedHaiku}*`)
      .setFooter(`by ${message.author.username}`)
      .setTimestamp();
    return message.channel.send(haikuEmbed);
  }

  // Commands
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  if (!client.commands.has(command)) return;
  try {
    client.commands.get(command).execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply("There was an error trying to execute that command!");
  }
});

client.login(process.env.DISCORD_TOKEN);
