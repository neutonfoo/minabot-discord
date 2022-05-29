import { model, Schema } from "mongoose";

export interface IPlayer {
  id: string;
  name: string;
  pointsScore: number;
  weeklyGamesPlayed: number;
  weeklyPointsScore: number;
  nextWeeklyPointsScore: number;
  roundsScore: number;
  longestStreak: number;
  currentStreak: number;
  isStreaking: boolean;
  games: Game[];
}

export interface Game {
  wordleIndex: number;
  isHardMode: boolean;
  attempts: number;
}

const playerSchema = new Schema<IPlayer>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  pointsScore: { type: Number },
  weeklyGamesPlayed: { type: Number },
  weeklyPointsScore: { type: Number },
  nextWeeklyPointsScore: { type: Number },
  roundsScore: { type: Number },
  longestStreak: { type: Number },
  games: [
    {
      wordleIndex: Number,
      isHardMode: Boolean,
      attempts: Number,
    },
  ],
});

export const Player = model<IPlayer>("Player", playerSchema);

export const NewPlayerBuilder = (authorId: string, authorName: string) =>
  new Player({
    id: authorId,
    name: authorName,
    weeklyGamesPlayed: 0,
    weeklyPointsScore: 0,
    nextWeeklyPointsScore: 0,
    pointsScore: 0,
    roundsScore: 0,
    longestStreak: 0,
    games: [],
  });

export interface IWordleMeta {
  currentWordleIndex: number;
  weekStartWordleIndex: number;
  numberOfPlayers: number;
  numberOfPlays: number;
  streaks: {
    id: number;
    name: string;
    games: number;
  }[];
}

const wordleMetaSchema = new Schema<IWordleMeta>({
  currentWordleIndex: { type: Number },
  weekStartWordleIndex: { type: Number },
  numberOfPlayers: { type: Number },
  numberOfPlays: { type: Number },
  streaks: [
    {
      id: { type: Number },
      name: { type: String },
      games: { type: Number },
    },
  ],
});

export const WordleMeta = model<IWordleMeta>("WordleMeta", wordleMetaSchema);
