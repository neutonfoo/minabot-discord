const { getTenorGif } = require(`../utils`);

module.exports = {
  name: "twice",
  description: "Loads a random GIF of Mina from Twice.",
  args: false,
  async execute(message, args) {
    message.channel.send(await getTenorGif("mina twice"));
  },
};
