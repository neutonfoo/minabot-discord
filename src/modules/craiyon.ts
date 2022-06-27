import { Message } from "discord.js";

import * as puppeteer from "puppeteer";

import CryptoJS from "crypto-js";

const prefix = "!gen ";
const savedImagePrefix = "craiyon_";

module.exports = {
  events: [
    {
      name: "messageCreate",
      async execute(message: Message) {
        if (message.author.bot) return false;

        // Get message info
        const content = message.content;

        if (content.startsWith(prefix)) {
          const generationQuery = content
            .substring(content.indexOf(" ") + 1)
            .trim();

          if (generationQuery) {
            await message.react("🐧");

            const startTime = performance.now();

            const browser = await puppeteer.launch({
              args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
            const page = await browser.newPage();
            await page.goto("https://www.craiyon.com/");
            await page.waitForNetworkIdle();

            const appElement = await page.$("#app");

            await page.type("div#prompt", generationQuery, {
              delay: 100,
            });

            await page.$eval("button", node => (node as HTMLElement).click());

            await page.waitForSelector("div.wrapper", {
              hidden: true,
              timeout: 0,
            });

            const savedImagePath = `${savedImagePrefix}${CryptoJS.MD5(
              generationQuery
            )}.png`;

            await appElement!.screenshot({
              path: savedImagePath,
            });

            await browser.close();

            const secondsElapsed = (performance.now() - startTime) / 1000;

            await message.react("☑");

            await message.reply({
              content: `\`${generationQuery}\` on craiyon completed in ${secondsElapsed.toFixed(
                3
              )} seconds!`,
              files: [
                {
                  attachment: savedImagePath,
                  name: savedImagePath,
                  description: `Generated image of ${generationQuery}`,
                },
              ],
            });
          }
        }
      },
    },
  ],
};
