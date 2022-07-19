import { SlashCommandBuilder } from "@discordjs/builders";
import * as puppeteer from "puppeteer";

import { IBotCommand, IBotEvent, IBotModule } from "../interfaces/BotModule";
import { MD5Hash, tmpDirectory } from "../util";

const BOT_MODULE_NAME = "Craiyon";
const BOT_MODULE_COMMAND_NAME = "craiyon";

const savedImagePrefix = "craiyon_";

const COMMANDS: IBotCommand[] = [
  {
    data: new SlashCommandBuilder()
      .setName(BOT_MODULE_COMMAND_NAME)
      .setDescription(`[${BOT_MODULE_NAME}] Generate an image with Craiyon!`)
      .addStringOption(option =>
        option
          .setName("prompt")
          .setDescription("The prompt to generate")
          .setRequired(true)
      ),

    execute: async interaction => {
      const optionPrompt = interaction.options.getString("prompt", true).trim();

      await interaction.reply(`🤖✏️ \`${optionPrompt}\``);

      const startTime = performance.now();

      const browser = await puppeteer.launch({
        // headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.goto("https://www.craiyon.com/");
      await page.waitForNetworkIdle();

      const appElement = await page.$("#app");
      const privacyButtons = await page.$(
        "#qc-cmp2-ui > div.qc-cmp2-footer.qc-cmp2-footer-overlay.qc-cmp2-footer-scrolled > div > button:nth-child(2)"
      );

      await privacyButtons?.click();

      await page.type("div#prompt", optionPrompt, {
        delay: 100,
      });

      await page.$eval("button", node => (node as HTMLElement).click());

      await page.waitForSelector("div.wrapper", {
        hidden: true,
        timeout: 0,
      });

      // Hide Video
      await page.addStyleTag({ content: "#aniplayer{display: none}" });

      const savedImagePath = `${tmpDirectory}/${savedImagePrefix}${MD5Hash(
        optionPrompt
      )}.png`;

      await appElement!.screenshot({
        path: savedImagePath,
      });

      await browser.close();

      const secondsElapsed = (performance.now() - startTime) / 1000;

      await interaction.channel?.send({
        content: `\`${optionPrompt}\` on craiyon completed in ${secondsElapsed.toFixed(
          3
        )} seconds! - <@${interaction.member?.user.id}>`,
        files: [
          {
            attachment: savedImagePath,
            name: savedImagePath,
            description: `Generated image of ${optionPrompt}`,
          },
        ],
      });
    },
  },
];

const EVENTS: IBotEvent[] = [];

module.exports = {
  bot_module_name: BOT_MODULE_NAME,
  commands: COMMANDS,
  events: EVENTS,
} as IBotModule;
