const { getTenorGif } = require(`../utils`);

module.exports = {
  name: "gif",
  description: "Information about the arguments provided.",
  args: true,
  async execute(message, args) {
    const searchTerm = args.join(" ");
    message.channel.send(await getTenorGif(searchTerm));
  },
};
