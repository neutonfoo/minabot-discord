import { model, Schema } from "mongoose";

export interface IPlayer {
  id: number;
  name: string;
  pointsScore: number;
  weeklyPointsScore: number;
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
  id: { type: Number, required: true },
  name: { type: String, required: true },
  pointsScore: { type: Number },
  weeklyPointsScore: { type: Number },
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
