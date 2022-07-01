import { CronJob } from "cron";
import { Client, Message, ActivityType } from "discord.js";
import { ActivityTypes } from "discord.js/typings/enums";

// # Twice Reaction
const twiceSongs = [
  "Like OOH-AHH",
  "Do It Again",
  "Going Crazy",
  "Truth",
  "Candy Boy",
  "Like a Fool",
  "CHEER UP",
  "Precious Love",
  "Touchdown",
  "Tuk Tok",
  "Woohoo",
  "My Headphones On",
  "Knock Knock",
  "Ice Cream",
  "TT",
  "1 to 10",
  "Ponytail",
  "Jelly Jelly",
  "Pit-A-Pat",
  "Next Page",
  "One in a Million",
  "Signal",
  "Three Times a Day",
  "Only You",
  "Hold Me Tight",
  "Eye Eye Eyes",
  "Someone Like Me",
  "Heart Shaker",
  "Merry & Happy",
  "Likey",
  "Turtle",
  "Missing U",
  "WOW",
  "FFW",
  "Ding Dong",
  "24/7",
  "Look At Me",
  "Rollin’",
  "Love Line",
  "Don’t Give Up",
  "You In My Heart",
  "Jaljayo Good Night",
  "Dance The Night Away",
  "Chillax",
  "Shot Thru the Heart",
  "What is Love?",
  "Sweet Talker",
  "Ho!",
  "Dejavu",
  "Say Yes",
  "Stuck",
  "The Best Thing I Ever Did",
  "YES or YES",
  "Say You Love Me",
  "Lalala",
  "Young & Wild",
  "Sunset",
  "After Moon",
  "Fancy",
  "Stuck in My Head",
  "Girls Like Us",
  "Hot",
  "Turn it Up",
  "Strawberry",
  "Feel Special",
  "Rainbow",
  "Get Loud",
  "Trick It",
  "Love Foolish",
  "21:29",
  "Swing",
  "Fake & True",
  "Stronger",
  "Breakthrough",
  "Changing!",
  "Happy Happy",
  "What You Waiting For",
  "Be OK",
  "POLISH",
  "How u doin'",
  "The Reason Why",
  "More & More",
  "Oxygen",
  "Firework",
  "Make Me Go",
  "Shadow",
  "Don’t Call Me Again",
  "Sweet Summer Day",
  "I Can’t Stop Me",
  "Hell in Heaven",
  "Up No More",
  "Do What We Like",
  "Bring It Back",
  "Believer",
  "Queen",
  "Go Hard",
  "Shot Clock",
  "Handle It",
  "Depend On You",
  "Say Something",
  "Behind The Mask",
  "Alcohol-Free",
  "First Time",
  "Scandal",
  "Conversation",
  "Baby Blue Love",
  "SOS",
  "Perfect World",
  "BETTER",
  "Good at Love",
  "Fanfare",
  "Kura Kura",
  "Four-leaf Clover",
  "In the summer",
  "PIECES OF LOVE",
  "Thank you, Family",
  "PROMISE",
  "Scientist",
  "Moonlight",
  "Icon",
  "Cruel",
  "Real You",
  "F.I.L.A (Fall In Love Again)",
  "Last Waltz",
  "Espresso",
  "Rewind",
  "Cactus",
  "Push & Pull",
  "Hello",
  "1, 3, 2",
  "Candy",
  "The Feels",
  "Cry For Me",
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
