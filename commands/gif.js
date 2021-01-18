const { getTenorGif } = require(`../utils`);

module.exports = {
  name: "gif",
  description: "Loads a random gif from TenorGIF.",
  args: true,
  async execute(message, args) {
    const searchTerm = args.join(" ");
    message.channel.send(await getTenorGif(searchTerm));
  },
};
