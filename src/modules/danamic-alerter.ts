import { CronJob } from "cron";
import { Client, Message, TextChannel } from "discord.js";

const puppeteer = require("puppeteer");

const DANAMIC_ALERTER_CHANNEL_ID = process.env.DANAMIC_ALERTER_CHANNEL_ID!;

module.exports = {
  events: [
    {
      name: "ready",
      async execute(client: Client) {
        (await cronMinuteChecker(client)).start();
      },
    },
    {
      name: "messageCreate",
      execute(message: Message) {
        if (message.author.bot) return false;
      },
    },
  ],
};

async function cronMinuteChecker(client: Client): Promise<CronJob> {
  return new CronJob(
    // Every Minute
    "0 * * * * *",
    async function () {
      const danamicAlerterChannel = client.channels.cache.get(
        DANAMIC_ALERTER_CHANNEL_ID
      ) as TextChannel;

      (async () => {
        const browser = await puppeteer.launch({
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();
        await page.goto("https://danamic.org/author/jeremytan/");
        await page.waitForNetworkIdle();

        const thumbTitleElements = await page.$$(".thumb-title");

        for (const thumbTitleElement of thumbTitleElements) {
          console.log(
            `${await thumbTitleElement.evaluate(
              (el: HTMLElement) => el.textContent
            )}`
          );
        }

        await browser.close();
      })();
    },
    null,
    false,
    "Pacific/Kiritimati"
  );
}
