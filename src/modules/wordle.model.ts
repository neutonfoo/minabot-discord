import { model, Schema } from "mongoose";

export interface IPlayer {
  id: number;
  name: string;
  totalScore: number;
  games: [
    {
      wordleIndex: number;
      isHardMode: boolean;
      attempts: number;
    }
  ];
}

export const playerSchema = new Schema<IPlayer>({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  games: [
    {
      wordleIndex: Number,
      isHardMode: Boolean,
      attempts: Number,
    },
  ],
});

export const Player = model<IPlayer>("Player", playerSchema);
