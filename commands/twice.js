const { getTenorGif } = require(`../utils`);

module.exports = {
  name: "twice",
  description: "Loads a random GIF of Twice.",
  args: false,
  async execute(message) {
    message.channel.send(await getTenorGif("twice"));
  },
};
