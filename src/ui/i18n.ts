import { pace, recipeNeeds } from "../game/logic/pace";
import { CANVAS_GOAL } from "../game/logic/quest";

/**
 * Instruction text. Japanese is optional help (Settings → にほんごの ヒント)
 * for instructions and story lines. Target English (commands, Kai's
 * questions, the answer sentences) is never translated.
 */

export interface Bi {
  en: string;
  ja: string;
}

/** Instruction amounts follow the same teacher pace as recipes and goals. */
export function hints(classroom: boolean): Record<string, { keys: Bi; touch: Bi }> {
  const axe = recipeNeeds("axe", classroom);
  const container = recipeNeeds("container", classroom);
  const rod = recipeNeeds("rod", classroom);
  const signalFire = recipeNeeds("signalFire", classroom);
  const bridgeWood = pace(classroom).bridgeNeeds.wood ?? 0;
  const canvasGoal = classroom ? CANVAS_GOAL.classroom : CANVAS_GOAL.normal;
  const catcherCanvas = pace(classroom).catcherCanvas;
  return {
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
      keys: { en: `Make a stone axe: ${axe.wood} wood + ${axe.stone} stone. Press C.`, ja: `木 ${axe.wood}つと 石 ${axe.stone}つで おのを つくろう。C キー` },
      touch: { en: `Make a stone axe: ${axe.wood} wood + ${axe.stone} stone. Tap the hammer.`, ja: `木 ${axe.wood}つと 石 ${axe.stone}つで おのを つくろう。ハンマーを タップ` }
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
      keys: { en: "Press C to make a tent.", ja: "C キーで テントを つくろう" },
      touch: { en: "Tap the hammer to make a tent.", ja: "ハンマーを タップして テントを つくろう" }
    },
    placeShelter: {
      keys: { en: "Click the tent in your bag to put it down.", ja: "バッグの テントを クリックして おこう" },
      touch: { en: "Tap the tent in your bag to put it down.", ja: "バッグの テントを タップして おこう" }
    },
    build: {
      keys: { en: "Go to your tent and press E to build it.", ja: "テントの ちかくで E を おして たてよう" },
      touch: { en: "Go to your tent and tap the hand to build it.", ja: "テントの ちかくで て を タップして たてよう" }
    },
    sleep: {
      keys: { en: "Sleep in your tent (or by the fire): press E there.", ja: "テント（か 火の そば）で E を おして ねよう" },
      touch: { en: "Sleep in your tent (or by the fire): tap the hand there.", ja: "テント（か 火の そば）で て を タップして ねよう" }
    },
    bridge: {
      keys: { en: `Take ${bridgeWood} wood to the broken bridge. Press E.`, ja: `木 ${bridgeWood}つを はしへ はこぼう。ちかくで E` },
      touch: { en: `Take ${bridgeWood} wood to the broken bridge. Tap the hand.`, ja: `木 ${bridgeWood}つを はしへ はこぼう。ちかくで てを タップ` }
    },
    container: {
      keys: { en: `Make a cup: ${container.coconut} coconut + ${container.leaves} leaves. Press C.`, ja: `ココナッツ ${container.coconut}つと はっぱ ${container.leaves}つで カップを つくろう。C キー` },
      touch: { en: `Make a cup: ${container.coconut} coconut + ${container.leaves} leaves. Tap the hammer.`, ja: `ココナッツ ${container.coconut}つと はっぱ ${container.leaves}つで カップを つくろう。ハンマーを タップ` }
    },
    water: {
      keys: { en: "Take your cup to the pond shore. Press E.", ja: "カップを もって いけの ほとりへ。E を おそう" },
      touch: { en: "Take your cup to the pond shore. Tap the hand.", ja: "カップを もって いけの ほとりへ。てを タップ" }
    },
    drink: {
      keys: { en: "Drink: click the water in your bag, or press F.", ja: "バッグの みずを クリックして のもう。F キーでも のめるよ" },
      touch: { en: "Drink: tap the water in your bag.", ja: "バッグの みずを タップして のもう" }
    },
    rod: {
      keys: { en: `Make a fishing rod: ${rod.wood} wood + ${rod.rope} rope. Press C. The beach box has rope!`, ja: `木 ${rod.wood}つと ロープ ${rod.rope}つで つりざおを つくろう。C キー。ロープは はまの はこに！` },
      touch: { en: `Make a fishing rod: ${rod.wood} wood + ${rod.rope} rope. Tap the hammer. The beach box has rope!`, ja: `木 ${rod.wood}つと ロープ ${rod.rope}つで つりざおを つくろう。ハンマーを タップ。ロープは はまの はこに！` }
    },
    fish: {
      keys: { en: "Take your rod to a fishing spot at the pond. Press E, then wait.", ja: "つりざおを もって いけの つりばへ。E を おして まとう" },
      touch: { en: "Take your rod to a fishing spot at the pond. Tap the hand, then wait.", ja: "つりざおを もって いけの つりばへ。てを タップして まとう" }
    },
    cook: {
      keys: { en: "Take the fish to a lit campfire. Press E to cook it.", ja: "さかなを もって たきびへ。E を おして やこう" },
      touch: { en: "Take the fish to a lit campfire. Tap the hand to cook it.", ja: "さかなを もって たきびへ。てを タップして やこう" }
    },
    torch: {
      keys: { en: "Press C to make a torch. Wood and leaves will help!", ja: "C キーで たいまつを つくろう。木と はっぱを あつめよう！" },
      touch: { en: "Tap the hammer to make a torch. Wood and leaves will help!", ja: "ハンマーを タップして たいまつを つくろう。木と はっぱを あつめよう！" }
    },
    cave: {
      keys: { en: "Take your torch to the cave mouth. Press E.", ja: "たいまつを もって どうくつの いりぐちへ。E を おそう" },
      touch: { en: "Take your torch to the cave mouth. Tap the hand.", ja: "たいまつを もって どうくつの いりぐちへ。てを タップ" }
    },
    metal: {
      keys: { en: "Find metal in the cave. Need help? Press Q.", ja: "どうくつで てつを さがそう。こまったら Q" },
      touch: { en: "Find metal in the cave. Need help? Tap the speech bubble.", ja: "どうくつで てつを さがそう。こまったら ふきだしを タップ" }
    },
    radio: {
      keys: { en: "Go to the old box in the cave. Press E.", ja: "どうくつの ふるい はこへ。ちかくで E を おそう" },
      touch: { en: "Go to the old box in the cave. Tap the hand.", ja: "どうくつの ふるい はこへ。ちかくで てを タップ" }
    },
    showKai: {
      keys: { en: "Leave the cave and show Kai your radio. Press E near him.", ja: "どうくつを でて、カイに ラジオを みせよう。ちかくで E" },
      touch: { en: "Leave the cave and show Kai your radio. Tap the hand near him.", ja: "どうくつを でて、カイに ラジオを みせよう。ちかくで てを タップ" }
    },
    cliffWait: {
      keys: { en: "Kai is walking to the rocks. Meet him there and wait.", ja: "カイが いわへ むかっているよ。いわの ところで まとう" },
      touch: { en: "Kai is walking to the rocks. Meet him there and wait.", ja: "カイが いわへ むかっているよ。いわの ところで まとう" }
    },
    cliff: {
      keys: { en: "Go to the rocks and ask Kai for help. Press E.", ja: "いわへ いって カイに てつだってもらおう。E を おそう" },
      touch: { en: "Go to the rocks and ask Kai for help. Tap the hand.", ja: "いわへ いって カイに てつだってもらおう。てを タップ" }
    },
    signalFire: {
      keys: { en: `Make a signal fire: ${signalFire.wood} wood + ${signalFire.leaves} leaves + ${signalFire.metal} metal. Press C.`, ja: `木 ${signalFire.wood}つ、はっぱ ${signalFire.leaves}つ、てつ ${signalFire.metal}つで のろしを つくろう。C キー` },
      touch: { en: `Make a signal fire: ${signalFire.wood} wood + ${signalFire.leaves} leaves + ${signalFire.metal} metal. Tap the hammer.`, ja: `木 ${signalFire.wood}つ、はっぱ ${signalFire.leaves}つ、てつ ${signalFire.metal}つで のろしを つくろう。ハンマーを タップ` }
    },
    clifftop: {
      keys: { en: "Follow the open path up to the clifftop.", ja: "ひらいた みちを のぼって がけの うえへ いこう" },
      touch: { en: "Follow the open path up to the clifftop.", ja: "ひらいた みちを のぼって がけの うえへ いこう" }
    },
    signal: {
      keys: { en: "Take the signal fire to the stone pad. Press E.", ja: "のろしを もって いしの わへ。E を おそう" },
      touch: { en: "Take the signal fire to the stone pad. Tap the hand.", ja: "のろしを もって いしの わへ。てを タップ" }
    },
    help: {
      keys: { en: "Listen to the radio and say what you need.", ja: "ラジオを きいて、ひつような ものを つたえよう" },
      touch: { en: "Listen to the radio and choose what you need.", ja: "ラジオを きいて、ひつような ものを えらぼう" }
    },
    micBlocked: {
      keys: { en: "The microphone is off. Choose the sentences.", ja: "マイクが つかえないので、ぶんを えらんで こたえよう" },
      touch: { en: "The microphone is off. Tap the sentences.", ja: "マイクが つかえないので、ぶんを タップして こたえよう" }
    },
    boil: {
      keys: { en: "Take the water to a lit fire. Press E to boil it.", ja: "みずを もって もえている 火へ。E で わかそう" },
      touch: { en: "Take the water to a lit fire. Tap the hand to boil it.", ja: "みずを もって もえている 火へ。てを タップして わかそう" }
    },
    // ---- Chapter 2 (Days 6–8)
    cove: {
      keys: { en: "The water is low! Walk east along the beach to the cove.", ja: "しおが ひいたよ！ すなはまを ひがしへ あるいて いりえへ" },
      touch: { en: "The water is low! Walk east along the beach to the cove.", ja: "しおが ひいたよ！ すなはまを ひがしへ あるいて いりえへ" }
    },
    askKai: {
      keys: { en: "Find something new near Kai. Press E and ask: “What is this?”", ja: "カイの ちかくで あたらしい ものを みつけて、E で「What is this?」" },
      touch: { en: "Find something new near Kai. Tap the hand and ask: “What is this?”", ja: "カイの ちかくで あたらしい ものを みつけて、てを タップして「What is this?」" }
    },
    coveBox: {
      keys: { en: "A box is in the sand! Walk to it and press E.", ja: "すなに はこが うまってる！ ちかくで E を おそう" },
      touch: { en: "A box is in the sand! Walk to it and tap the hand.", ja: "すなに はこが うまってる！ ちかくで てを タップ" }
    },
    canvas: {
      keys: { en: `Get ${canvasGoal} canvas from the torn sails. Press E.`, ja: `やぶれた ほから ぬのを ${canvasGoal}まい あつめよう。E を おそう` },
      touch: { en: `Get ${canvasGoal} canvas from the torn sails. Tap the hand.`, ja: `やぶれた ほから ぬのを ${canvasGoal}まい あつめよう。てを タップ` }
    },
    carryBox: {
      keys: { en: "Walk to the big box and press E. Ask Kai for help!", ja: "おおきな はこへ いって E。カイに てつだってもらおう！" },
      touch: { en: "Walk to the big box and tap the hand. Ask Kai for help!", ja: "おおきな はこへ いって てを タップ。カイに てつだってもらおう！" }
    },
    carrying: {
      keys: { en: "Walk slowly to camp. Press E to put it down.", ja: "ゆっくり キャンプへ。E で おろそう" },
      touch: { en: "Walk slowly to camp. Tap the hand to put it down.", ja: "ゆっくり キャンプへ。てを タップして おろそう" }
    },
    grove: {
      keys: { en: "Take your axe to the thick bamboo in the forest. Press E.", ja: "おのを もって もりの たけやぶへ。E を おそう" },
      touch: { en: "Take your axe to the thick bamboo in the forest. Tap the hand.", ja: "おのを もって もりの たけやぶへ。てを タップ" }
    },
    poles: {
      keys: { en: "Cut tall bamboo for poles. Press E near a bamboo plant.", ja: "せの たかい たけを きって ぼうを あつめよう。ちかくで E" },
      touch: { en: "Cut tall bamboo for poles. Tap the hand near a bamboo plant.", ja: "せの たかい たけを きって ぼうを あつめよう。ちかくで てを タップ" }
    },
    rackSite: {
      keys: { en: "Talk to Kai at camp. Then walk to move it, R to turn, E to put it down.", ja: "キャンプで カイと はなそう。あるいて うごかし、R で まわし、E で おく" },
      touch: { en: "Talk to Kai at camp. Then walk to move it, turn it, and tap to put it down.", ja: "キャンプで カイと はなそう。あるいて うごかし、まわして、タップで おく" }
    },
    rackFrame: {
      keys: { en: "Walk round the rack. Press E to put a pole in the green place.", ja: "ほしだなの まわりを あるこう。みどりの ところで E を おして ぼうを いれよう" },
      touch: { en: "Walk round the rack. Tap the hand to put a pole in the green place.", ja: "ほしだなの まわりを あるこう。みどりの ところで てを タップ" }
    },
    rackStrong: {
      keys: { en: "It's shaking! Put a pole across a long side and a short side.", ja: "ゆれてる！ ながい がわと みじかい がわに ななめの ぼうを いれよう" },
      touch: { en: "It's shaking! Put a pole across a long side and a short side.", ja: "ゆれてる！ ながい がわと みじかい がわに ななめの ぼうを いれよう" }
    },
    dryFish: {
      keys: { en: "Take a fish to the rack. Press E to hang it up.", ja: "さかなを もって ほしだなへ。E で つるそう" },
      touch: { en: "Take a fish to the rack. Tap the hand to hang it up.", ja: "さかなを もって ほしだなへ。てを タップして つるそう" }
    },
    barrel: {
      keys: { en: "Go to the cove and bring the barrel to camp. Press E.", ja: "いりえへ いって たるを キャンプへ はこぼう。E を おそう" },
      touch: { en: "Go to the cove and bring the barrel to camp. Tap the hand.", ja: "いりえへ いって たるを キャンプへ はこぼう。てを タップ" }
    },
    catcherSite: {
      keys: { en: "Talk to Kai at camp. Then put the rain catcher down near the barrel.", ja: "キャンプで カイと はなそう。そして たるの ちかくに おこう" },
      touch: { en: "Talk to Kai at camp. Then put the rain catcher down near the barrel.", ja: "キャンプで カイと はなそう。そして たるの ちかくに おこう" }
    },
    catcherBuilt: {
      keys: { en: `Put in four posts. Then the canvas (${catcherCanvas.canvas} canvas + ${catcherCanvas.rope} rope) in the middle.`, ja: `はしらを 4ほん。そのあと まんなかに ぬの（ぬの ${catcherCanvas.canvas}まい と ロープ ${catcherCanvas.rope}ほん）` },
      touch: { en: `Put in four posts. Then the canvas (${catcherCanvas.canvas} canvas + ${catcherCanvas.rope} rope) in the middle.`, ja: `はしらを 4ほん。そのあと まんなかに ぬの（ぬの ${catcherCanvas.canvas}まい と ロープ ${catcherCanvas.rope}ほん）` }
    },
    catchRain: {
      keys: { en: "Make one corner low, over the barrel. E at a corner or the barrel. E in the middle to test.", ja: "ひとつの かどを ひくくして、たるの うえに。かど か たるで E。まんなかで E で ためす" },
      touch: { en: "Make one corner low, over the barrel. Tap a corner or the barrel. Tap the middle to test.", ja: "ひとつの かどを ひくくして、たるの うえに。かど か たるを タップ。まんなかで ためす" }
    },
    boilRain: {
      keys: { en: "Get water from the barrel, make a fire, and boil the water.", ja: "たるから みずを とって、火を つけて、みずを わかそう" },
      touch: { en: "Get water from the barrel, make a fire, and boil the water.", ja: "たるから みずを とって、火を つけて、みずを わかそう" }
    },
    // Chapter 3 (Days 9–10).
    upper: {
      keys: { en: "Go over the bridge to the pond. A path climbs to the waterfall.", ja: "はしを わたって いけへ。たきへ のぼる みちが あるよ" },
      touch: { en: "Go over the bridge to the pond. A path climbs to the waterfall.", ja: "はしを わたって いけへ。たきへ のぼる みちが あるよ" }
    },
    pipePlan: {
      keys: { en: "Talk to Kai by the waterfall. Press E.", ja: "たきの そばで カイと はなそう。E を おそう" },
      touch: { en: "Talk to Kai by the waterfall. Tap the hand.", ja: "たきの そばで カイと はなそう。てを タップ" }
    },
    tangle: {
      keys: { en: "Take your axe to the old bamboo at the top of the rock stairs. Press E.", ja: "おのを もって いわの かいだんの うえの ふるい たけへ。E を おそう" },
      touch: { en: "Take your axe to the old bamboo at the top of the rock stairs. Tap the hand.", ja: "おのを もって いわの かいだんの うえの ふるい たけへ。てを タップ" }
    },
    bucket: {
      keys: { en: "E at the rock with the water. Walk to aim the pipe. Make it go down to the bucket.", ja: "みずが おちる いわで E。あるいて むきを きめて、バケツまで くだる パイプに しよう" },
      touch: { en: "Tap the rock with the water. Walk to aim the pipe. Make it go down to the bucket.", ja: "みずが おちる いわを タップ。あるいて むきを きめて、バケツまで くだる パイプに しよう" }
    },
    pipeCamp: {
      keys: { en: "Build a pipe from the waterfall down the stairs to camp. E at a post to change it.", ja: "たきから かいだんを おりて キャンプまで パイプを つくろう。はしらで E で かえられる" },
      touch: { en: "Build a pipe from the waterfall down the stairs to camp. Tap a post to change it.", ja: "たきから かいだんを おりて キャンプまで パイプを つくろう。はしらを タップで かえられる" }
    },
    fillTank: {
      keys: { en: "The tank goes under the end of the pipe. Carry it with Kai, or bring the pipe to it.", ja: "タンクは パイプの はしの したに。カイと はこぶか、パイプを のばそう" },
      touch: { en: "The tank goes under the end of the pipe. Carry it with Kai, or bring the pipe to it.", ja: "タンクは パイプの はしの したに。カイと はこぶか、パイプを のばそう" }
    },
    boilTank: {
      keys: { en: "Get water from the tank with your cup. Boil it at the fire.", ja: "カップで タンクの みずを とって、火で わかそう" },
      touch: { en: "Get water from the tank with your cup. Boil it at the fire.", ja: "カップで タンクの みずを とって、火で わかそう" }
    },
    laying: {
      keys: { en: "Walk to aim · T long/short · X higher · Z lower · E put · Esc done", ja: "あるいて むきを きめる ・ T ながさ ・ X たかく ・ Z ひくく ・ E おく ・ Esc おわり" },
      touch: { en: "Walk to aim the pipe. Use the buttons to change it and put it.", ja: "あるいて むきを きめよう。ボタンで かえて、おこう" }
    }
  };
}

export const HINTS = hints(false);

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
