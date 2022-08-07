import { CronCommand, CronJob } from 'cron';
import crypto from 'crypto';

export const tmpDirectory = 'tmp';

export const createCronJob = (
  cronTime: string,
  timeZone: string,
  onTick: CronCommand,
) => new CronJob(cronTime, onTick, null, false, timeZone);

// # Twice Reaction
export const twiceReactionEmojiIds = [
  '812417222583517234',
  '813175312245850113',
  '813175312602628106',
  '813175312795828225',
  '813178058394566668',
  '813175312552689674',
  '813175312246243359',
  '813175311813836801',
  '813175312766468136',
];

export const MD5 = (s: string) =>
  crypto.createHash('md5').update(s).digest('hex');

export const randomIntBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min);

export const randomHSL = () => `hsl(${randomIntBetween(0, 360)}%, 100%, 50%)`;
