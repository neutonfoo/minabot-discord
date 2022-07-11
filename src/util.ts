import CryptoJS from "crypto-js";

export const tmpDirectory = "tmp";

// # Twice Reaction
export const twiceReactionEmojiIds = [
  "812417222583517234",
  "813175312245850113",
  "813175312602628106",
  "813175312795828225",
  "813178058394566668",
  "813175312552689674",
  "813175312246243359",
  "813175311813836801",
  "813175312766468136",
];

export const MD5Hash = (text: string): string => CryptoJS.MD5(text).toString();
