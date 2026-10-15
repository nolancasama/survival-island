import { getGame, setGame } from "../store";
import { rt } from "../runtime";
import { count } from "../logic/inventory";
import { CAVE_ENTRY, CAVE_EXIT, CAVE_OUTSIDE } from "../world/phase3";
import { groundY } from "../world/island";
import { ask, say } from "./ask";
import { refreshQuest, save, updateHint, wait } from "./session";
import { audio } from "../../audio/audio";

/** Enter and leave the separate cave set through the same short fade. */
async function crossCave(inside: boolean) {
  setGame({ mode: "busy", focus: null, fade: 1 });
  rt.beacons = { ids: [], until: 0 };
  await wait(650);
  const at = inside ? CAVE_ENTRY : CAVE_OUTSIDE;
  setGame({ inCave: inside, enteredCave: getGame().enteredCave || inside });
  const p = rt.player;
  p.x = at.x;
  p.z = at.z;
  p.y = groundY(at.x, at.z);
  p.yaw = at.yaw;
  p.vx = p.vz = p.speed = 0;
  p.action = null;
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  rt.camera.yaw = at.yaw + Math.PI;
  rt.camera.snap = true;
  refreshQuest();
  setGame({ fade: 0 });
  await wait(650);
  setGame({ mode: "explore" });
  updateHint();
  save();
}

/** The torch is a bag requirement each visit; English gates the first entry. */
export async function enterCave() {
  if (getGame().inCave) return;
  if (count(getGame().bag, "torch") === 0) {
    setGame({ mode: "talk", focus: null });
    await say("self", "It's dark! I need a torch.", "くらい！ たいまつが ひつようだ。");
    setGame({ mode: "explore" });
    return;
  }
  if (!getGame().known.includes("goCave")) {
    const said = await ask({ kind: "command", options: ["goCave"], picture: "torch", cancellable: true, readSentence: true });
    if (!said) return;
  }
  audio.play("torch");
  await crossCave(true);
}

/** Walking into the entrance light leaves without another English prompt. */
export function checkCaveExit() {
  const g = getGame();
  if (!g.inCave || g.mode !== "explore" || g.settingsOpen) return;
  if (Math.hypot(rt.player.x - CAVE_EXIT.x, rt.player.z - CAVE_EXIT.z) <= CAVE_EXIT.r) {
    void crossCave(false);
  }
}
