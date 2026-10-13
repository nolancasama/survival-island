import { useGame } from "../game/store";
import { ITEMS, type ItemId } from "../game/types";
import { RECIPES, RECIPE_ORDER, checkCraft } from "../game/logic/crafting";
import { count } from "../game/logic/inventory";
import { cancelPlacing, closeCraft, confirmPlacing, makeItem, rotatePlacing } from "../game/flow/actions";
import { Icon } from "./icons";

function Ja({ children }: { children: React.ReactNode }) {
  const on = useGame((s) => s.settings.japanese);
  if (!on) return null;
  return (
    <small className="ja" lang="ja">
      {children}
    </small>
  );
}

/**
 * The Craft menu: recipe cards with ingredient icons and a tick per
 * ingredient. No arithmetic: "have 2 of 3" is shown as a count on the icon.
 */
export function CraftPanel() {
  const open = useGame((s) => s.craftOpen);
  const bag = useGame((s) => s.bag);
  const unlocked = useGame((s) => s.unlocked);
  if (!open) return null;
  const shown = RECIPE_ORDER.filter((id) => unlocked.includes(id));
  const locked = RECIPE_ORDER.length - shown.length;
  return (
    <div className="panel craft-panel ui" data-testid="craft" role="dialog" aria-label="Make">
      <div className="craft-head">
        <Icon id="craft" size={30} />
        <h2>
          Make <Ja>つくる</Ja>
        </h2>
        <button className="close" onClick={() => closeCraft()} aria-label="Close" data-testid="craft-close">
          <Icon id="close" size={20} />
        </button>
      </div>
      <div className="recipes">
        {shown.map((id) => {
          const r = RECIPES[id];
          const ok = checkCraft(bag, id, unlocked) === "ok";
          return (
            <div key={id} className={`recipe ${ok ? "ready" : ""}`} data-testid={`recipe-${id}`}>
              <div className="recipe-icon">
                <Icon id={id} size={56} />
              </div>
              <div className="recipe-body">
                <strong>{ITEMS[id].en}</strong>
                <span className="purpose">
                  {r.purpose.en}
                  <Ja>{r.purpose.ja}</Ja>
                </span>
                <div className="needs-row">
                  {(Object.entries(r.needs) as Array<[ItemId, number]>).map(([item, n]) => {
                    const have = count(bag, item);
                    const enough = have >= n;
                    return (
                      <span key={item} className={`need ${enough ? "ok" : "short"}`} title={`${ITEMS[item].en}: ${have}/${n}`}>
                        <Icon id={item} size={30} />
                        <span className="need-n">{enough ? "✓" : `${have}/${n}`}</span>
                        <span className="need-word">{ITEMS[item].en}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <button className="primary make" disabled={!ok} onClick={() => void makeItem(id)} data-testid={`make-${id}`}>
                Make!
              </button>
            </div>
          );
        })}
        {locked > 0 && (
          <div className="recipe locked">
            <Icon id="lock" size={32} />
            <span>
              {locked} more… Kai will teach you.
              <Ja>カイが おしえて くれるよ</Ja>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Buttons while placing a building (mouse and touch). */
export function PlaceBar() {
  const placing = useGame((s) => s.placing);
  const mode = useGame((s) => s.mode);
  const touch = useGame((s) => s.touch);
  if (mode !== "place" || !placing) return null;
  const why = placing.problem;
  return (
    <div className="panel placebar ui" data-testid="placebar">
      <Icon id={placing.item} size={40} />
      <div className="place-text">
        <strong>Put the {ITEMS[placing.item].en} down.</strong>
        {why && <span className="bad">{why === "water" ? "Not in the water!" : why === "edge" ? "Too close to the edge." : "Something is in the way."}</span>}
        <Ja>あるいて ばしょを きめよう</Ja>
      </div>
      <button className="round" onClick={() => rotatePlacing()} aria-label="Turn" data-testid="place-rotate">
        <Icon id="rotate" size={26} />
        {!touch && <kbd>R</kbd>}
      </button>
      <button className="round ok" disabled={Boolean(why)} onClick={() => confirmPlacing()} aria-label="Put it here" data-testid="place-ok">
        <Icon id="check" size={28} />
        {!touch && <kbd>E</kbd>}
      </button>
      <button className="round cancel" onClick={() => cancelPlacing()} aria-label="Cancel" data-testid="place-cancel">
        <Icon id="close" size={22} />
        {!touch && <kbd>Esc</kbd>}
      </button>
    </div>
  );
}
