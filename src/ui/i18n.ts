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
  axe: {
    keys: { en: "Make a stone axe: 2 wood + 1 stone. Press C.", ja: "木 2つと 石 1つで おのを つくろう。C キー" },
    touch: { en: "Make a stone axe: 2 wood + 1 stone. Tap the hammer.", ja: "木 2つと 石 1つで おのを つくろう。ハンマーを タップ" }
  },
  path: {
    keys: { en: "Go to the big tree in the forest gap. Press E.", ja: "もりの いりぐちの おおきな 木へ。E を おそう" },
    touch: { en: "Go to the big tree in the forest gap. Tap the hand.", ja: "もりの いりぐちの おおきな 木へ。て を タップ" }
  },
  leaves: {
    keys: { en: "Find leaves in the forest. Need help? Press Q.", ja: "もりで はっぱを さがそう。こまったら Q" },
    touch: { en: "Find leaves in the forest. Need help? Tap the speech bubble.", ja: "もりで はっぱを さがそう。こまったら ふきだしを タップ" }
  },
  wood2: {
    keys: { en: "Cut trees with your axe: go to a tree and press E.", ja: "おので 木を きろう。木の ちかくで E" },
    touch: { en: "Cut trees with your axe: go to a tree and tap the hand.", ja: "おので 木を きろう。木の ちかくで て を タップ" }
  },
  shelter: {
    keys: { en: "Press C to make a shelter.", ja: "C キーで こやを つくろう" },
    touch: { en: "Tap the hammer to make a shelter.", ja: "ハンマーを タップして こやを つくろう" }
  },
  placeShelter: {
    keys: { en: "Click the shelter in your bag to put it down.", ja: "バッグの こやを クリックして おこう" },
    touch: { en: "Tap the shelter in your bag to put it down.", ja: "バッグの こやを タップして おこう" }
  },
  build: {
    keys: { en: "Go to your shelter and press E to build it.", ja: "こやの ちかくで E を おして たてよう" },
    touch: { en: "Go to your shelter and tap the hand to build it.", ja: "こやの ちかくで て を タップして たてよう" }
  },
  sleep: {
    keys: { en: "Sleep in your shelter (or by the fire): press E there.", ja: "こや（か 火の そば）で E を おして ねよう" },
    touch: { en: "Sleep in your shelter (or by the fire): tap the hand there.", ja: "こや（か 火の そば）で て を タップして ねよう" }
  },
  bridge: {
    keys: { en: "Take four wood to the broken bridge. Press E.", ja: "木 4つを はしへ はこぼう。ちかくで E" },
    touch: { en: "Take four wood to the broken bridge. Tap the hand.", ja: "木 4つを はしへ はこぼう。ちかくで てを タップ" }
  },
  container: {
    keys: { en: "Make a water container: 1 coconut + 2 leaves. Press C.", ja: "ココナッツ 1つと はっぱ 2つで みずいれを つくろう。C キー" },
    touch: { en: "Make a water container: 1 coconut + 2 leaves. Tap the hammer.", ja: "ココナッツ 1つと はっぱ 2つで みずいれを つくろう。ハンマーを タップ" }
  },
  water: {
    keys: { en: "Take your container to the pond shore. Press E.", ja: "みずいれを もって いけの ほとりへ。E を おそう" },
    touch: { en: "Take your container to the pond shore. Tap the hand.", ja: "みずいれを もって いけの ほとりへ。てを タップ" }
  },
  drink: {
    keys: { en: "Drink: click the water in your bag, or press F.", ja: "バッグの みずを クリックして のもう。F キーでも のめるよ" },
    touch: { en: "Drink: tap the water in your bag.", ja: "バッグの みずを タップして のもう" }
  },
  rod: {
    keys: { en: "Make a fishing rod: 2 wood + 1 rope. Press C. The beach box has rope!", ja: "木 2つと ロープ 1つで つりざおを つくろう。C キー。ロープは はまの はこに！" },
    touch: { en: "Make a fishing rod: 2 wood + 1 rope. Tap the hammer. The beach box has rope!", ja: "木 2つと ロープ 1つで つりざおを つくろう。ハンマーを タップ。ロープは はまの はこに！" }
  },
  fish: {
    keys: { en: "Take your rod to a fishing spot at the pond. Press E, then wait.", ja: "つりざおを もって いけの つりばへ。E を おして まとう" },
    touch: { en: "Take your rod to a fishing spot at the pond. Tap the hand, then wait.", ja: "つりざおを もって いけの つりばへ。てを タップして まとう" }
  },
  cook: {
    keys: { en: "Take the fish to a lit campfire. Press E to cook it.", ja: "さかなを もって たきびへ。E を おして やこう" },
    touch: { en: "Take the fish to a lit campfire. Tap the hand to cook it.", ja: "さかなを もって たきびへ。てを タップして やこう" }
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
