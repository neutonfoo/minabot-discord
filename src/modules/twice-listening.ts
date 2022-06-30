import { CronJob } from "cron";
import { Client, Message, ActivityType } from "discord.js";
import { ActivityTypes } from "discord.js/typings/enums";

// # Twice Reaction
const twiceSongs = [
  "Like Ooh-Ahh",
  "Cheer Up",
  "TT",
  "Knock Knock",
  "Signal",
  "Likey",
  "Heart Shaker",
  "What is Love",
  "Dance The Night Away",
  "Yes or Yes",
  "Fancy",
  "Feel Special",
  "More & More",
  "I CAN'T STOP ME",
  "Cry For Me",
  "Alcohol Free",
  "The Feels",
  "Scientist",
];

module.exports = {
  events: [
    {
      name: "ready",
      async execute(client: Client) {
        (await cronTwiceSongPicker(client)).start();
      },
    },
  ],
};

async function cronTwiceSongPicker(client: Client): Promise<CronJob> {
  return new CronJob(
    // Every Minute
    "0 * * * * *",
    async function () {
      client?.user?.setActivity(
        twiceSongs[Math.floor(Math.random() * twiceSongs.length)],
        {
          type: ActivityTypes.LISTENING,
        }
      );
    },
    null,
    false,
    "Pacific/Kiritimati"
  );
}
