import { getGame, setGame } from "../store";
import { cancelAsk, chooseIndex, hasLine, micPress, nextLine } from "./ask";
import { cancelPlacing, closeCraft, confirmPlacing, eatFirst, interact, makeItem, needs, openCraft, rotatePlacing } from "./actions";
import { checkCraft, RECIPE_ORDER } from "../logic/crafting";

/** Fresh key presses, routed by what is on screen. Movement keys are read per frame. */
export function onKey(code: string) {
  const g = getGame();
  if (g.screen !== "game") return;

  if (g.settingsOpen) {
    if (code === "Escape") setGame({ settingsOpen: false });
    return;
  }

  if (hasLine()) {
    if (code === "Space" || code === "KeyE" || code === "Enter" || code === "NumpadEnter") nextLine();
    return;
  }

  switch (g.mode) {
    case "ask": {
      if (code === "Space") micPress();
      else if (code === "Escape") cancelAsk();
      else if (code.startsWith("Digit") || code.startsWith("Numpad")) {
        const n = Number(code.replace(/\D/g, ""));
        if (n >= 1 && n <= 4) chooseIndex(n - 1);
      }
      return;
    }
    case "craft": {
      if (code === "Escape" || code === "KeyC") closeCraft();
      else if (code === "Enter" || code === "KeyE") {
        const ready = RECIPE_ORDER.find((id) => checkCraft(g.bag, id, g.unlocked) === "ok");
        if (ready) void makeItem(ready);
      }
      return;
    }
    case "place": {
      if (code === "KeyE" || code === "Enter" || code === "Space") confirmPlacing();
      else if (code === "KeyR") rotatePlacing();
      else if (code === "Escape") cancelPlacing();
      return;
    }
    case "explore": {
      if (code === "KeyE" || code === "Enter") void interact();
      else if (code === "KeyQ") void needs();
      else if (code === "KeyC") openCraft();
      else if (code === "KeyF") void eatFirst();
      else if (code === "Escape") setGame({ settingsOpen: true });
      return;
    }
    default:
      return;
  }
}
