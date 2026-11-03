// Puts every sound effect in a video at one level: each file's loudest point lands the same
// distance under the voice's, so a ding and a swoosh sit equally far under the speaker.
// Run it once per video and play each effect at its volume everywhere it's used.
//
//   node effect-levels.mjs <voice.wav> <dB under the voice> <effect files...>
//     Prints { "<file name>": volume } for each effect's <Audio volume>.
import { basename } from "node:path";
import { measure } from "./loudness.mjs";

const [voice, underArg, ...effects] = process.argv.slice(2);
const under = Number(underArg);
if (!voice || !(under >= 0) || effects.length === 0) {
  console.error("usage: effect-levels.mjs <voice.wav> <dB under the voice> <effect files...>");
  process.exit(1);
}

const target = measure(voice).peak - under;
const volumes = Object.fromEntries(effects.map((file) => [basename(file), Number((10 ** ((target - measure(file).peak) / 20)).toFixed(3))]));
console.log(JSON.stringify(volumes, null, 2));
