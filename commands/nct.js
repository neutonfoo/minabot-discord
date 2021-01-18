const { getTenorGif } = require(`../utils`);

module.exports = {
  name: "nct",
  description: "Loads a random GIF of BTS.",
  args: false,
  async execute(message, args) {
    message.channel.send(await getTenorGif("nct"));
  },
};
