/**
 * Instruction text. Japanese is optional help (Settings → にほんごの ヒント)
 * for instructions and story lines. Target English (commands, Kai's
 * questions, the answer sentences) is never translated.
 */

export interface Bi {
  en: string;
  ja: string;
}

export const HINTS: Record<string, { keys: Bi; touch: Bi }> = {
  move: {
    keys: { en: "Walk: WASD / arrows · Run: Shift · Look: drag", ja: "WASD・やじるしで あるく ／ Shiftで はしる ／ ドラッグで みまわす" },
    touch: { en: "Walk: left stick · Look: drag", ja: "ひだりの スティックで あるく ／ ドラッグで みまわす" }
  },
  coconut: {
    keys: { en: "Walk to a glowing coconut. Press E.", ja: "ひかっている ココナッツへ いって、E を おそう" },
    touch: { en: "Walk to a glowing coconut. Tap the hand.", ja: "ひかっている ココナッツへ いって、て を タップ" }
  },
  eat: {
    keys: { en: "Eat it: press F, or click the coconut in your bag.", ja: "F キー か、バッグの ココナッツを クリックして たべよう" },
    touch: { en: "Eat it: tap the coconut in your bag.", ja: "バッグの ココナッツを タップして たべよう" }
  },
  kai: {
    keys: { en: "Someone is waving! Walk over and press E.", ja: "だれかが てを ふっている！ ちかくで E を おそう" },
    touch: { en: "Someone is waving! Walk over and tap the hand.", ja: "だれかが てを ふっている！ ちかくで て を タップ" }
  },
  gather: {
    keys: { en: "Find wood and stones. Need help? Press Q: “I need…”", ja: "木と 石を さがそう。こまったら Q で「I need…」" },
    touch: { en: "Find wood and stones. Need help? Tap the speech bubble.", ja: "木と 石を さがそう。こまったら ふきだしを タップ" }
  },
  craft: {
    keys: { en: "Press C to make a campfire.", ja: "C キーで たきびを つくろう" },
    touch: { en: "Tap the hammer to make a campfire.", ja: "ハンマーを タップして たきびを つくろう" }
  },
  place: {
    keys: { en: "Click the campfire in your bag to put it down.", ja: "バッグの たきびを クリックして おこう" },
    touch: { en: "Tap the campfire in your bag to put it down.", ja: "バッグの たきびを タップして おこう" }
  },
  light: {
    keys: { en: "Go to your campfire and press E.", ja: "たきびの ちかくで E を おそう" },
    touch: { en: "Go to your campfire and tap the hand.", ja: "たきびの ちかくで て を タップ" }
  },
  micBlocked: {
    keys: { en: "The microphone is off. Choose the sentences.", ja: "マイクが つかえないので、ぶんを えらんで こたえよう" },
    touch: { en: "The microphone is off. Tap the sentences.", ja: "マイクが つかえないので、ぶんを タップして こたえよう" }
  }
};

export const UI = {
  speakKeys: { en: "Press SPACE and say it!", ja: "スペースを おして えいごで いおう！" },
  speakTouch: { en: "Tap the mic and say it!", ja: "マイクを タップして えいごで いおう！" },
  listening: { en: "Listening…", ja: "きいてるよ…" },
  tryAgain: { en: "Try again!", ja: "もういちど！" },
  listen: { en: "Listen and say it.", ja: "よく きいて、いってみよう" },
  unclear: { en: "Say one sentence.", ja: "ひとつだけ いおう" },
  choose: { en: "Choose the sentence.", ja: "ぶんを えらぼう" },
  rescue: { en: "You can tap the sentence, too.", ja: "ぶんを タップしても いいよ" },
  wrong: { en: "Look at the picture. Try again!", ja: "えを よく みて。もういちど！" },
  next: { en: "Next", ja: "つぎへ" },
  full: { en: "Your bag is full!", ja: "もう もてないよ！" },
  imFull: { en: "I'm full!", ja: "おなか いっぱい！" }
} as const;
