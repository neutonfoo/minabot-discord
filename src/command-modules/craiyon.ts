import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  CommandModuleImpl,
  EventListenerImpl,
  SlashCommandImpl,
} from '../models';
import puppeteer from 'puppeteer';
import { MD5, tmpDirectory } from '../utility';

const NAME = 'Craiyon';
const COMMAND_NAME = 'craiyon';
const savedImagePrefix = 'craiyon_';

const slashCommands: SlashCommandImpl = {
  data: new SlashCommandBuilder()
    .setName(COMMAND_NAME)
    .setDescription(`[${NAME}] Generate an image with Craiyon!`)
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('The prompt to generate')
        .setRequired(true),
    ),
  execute: async (interaction: CommandInteraction) => {
    if (!interaction.isChatInputCommand()) return;

    const optionPrompt = interaction.options.getString('prompt', true).trim();

    await interaction.reply(`🤖✏️ \`${optionPrompt}\``);

    const startTime = performance.now();

    const browser = await puppeteer.launch({
      // headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto('https://www.craiyon.com/');
    await page.waitForNetworkIdle();

    const appElement = await page.$('#app');
    const privacyButtons = await page.$(
      '#qc-cmp2-ui > div.qc-cmp2-footer.qc-cmp2-footer-overlay.qc-cmp2-footer-scrolled > div > button:nth-child(2)',
    );

    await privacyButtons?.click();

    await page.type('div#prompt', optionPrompt, {
      delay: 100,
    });

    await page.$eval('button', (node) => (node as HTMLElement).click());

    await page.waitForSelector('div.wrapper', {
      hidden: true,
      timeout: 0,
    });

    // Hide Video
    await page.addStyleTag({ content: '#aniplayer{display: none}' });

    const savedImagePath = `${tmpDirectory}/${savedImagePrefix}${MD5(
      optionPrompt,
    )}.png`;

    await appElement!.screenshot({
      path: savedImagePath,
    });

    await browser.close();

    const secondsElapsed = (performance.now() - startTime) / 1000;

    await interaction.channel?.send({
      content: `\`${optionPrompt}\` on craiyon completed in ${secondsElapsed.toFixed(
        3,
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
};

const commandModule: CommandModuleImpl = {
  name: NAME,
  commandName: COMMAND_NAME,
  slashCommands,
};

export default commandModule;
