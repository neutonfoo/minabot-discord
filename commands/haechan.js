const { getTenorGif } = require(`../utils`);

module.exports = {
  name: "haechan",
  description: "Loads a random GIF of Haechan from NCT.",
  args: false,
  async execute(message, args) {
    message.channel.send(await getTenorGif("haechan"));
  },
};
