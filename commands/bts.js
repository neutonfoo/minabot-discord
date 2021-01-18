const { getTenorGif } = require(`../utils`);

module.exports = {
  name: "bts",
  description: "Loads a random GIF of NCT.",
  args: false,
  async execute(message, args) {
    message.channel.send(await getTenorGif("nct"));
  },
};
