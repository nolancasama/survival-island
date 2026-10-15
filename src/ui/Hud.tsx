import { useGame, setGame } from "../game/store";
import { ITEMS, ITEM_ORDER, type ItemId } from "../game/types";
import { dayDef, stepGoal } from "../game/logic/quest";
import { count } from "../game/logic/inventory";
import { needs, openCraft, useItem } from "../game/flow/actions";
import { Icon, type IconId } from "./icons";
import { hints } from "./i18n";

function Ja({ children }: { children: React.ReactNode }) {
  const on = useGame((s) => s.settings.japanese);
  if (!on) return null;
  return (
    <small className="ja" lang="ja">
      {children}
    </small>
  );
}

function Bar({ icon, label, value, tone, testId }: { icon: IconId; label: string; value: number; tone: string; testId: string }) {
  const low = value < 25;
  return (
    <div className={`stat ${low ? "low" : ""}`} data-testid={testId} title={`${label}: ${value}`}>
      <Icon id={icon} size={26} />
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <div className="bar">
          <div className={`bar-fill ${tone}`} style={{ width: `${value}%` }} />
        </div>
      </div>
    </div>
  );
}

function Stats() {
  const s = useGame((st) => st.stats);
  return (
    <div className="panel stats ui" aria-label="Your stats">
      <Bar icon="heart" label="HP" value={s.hp} tone="hp" testId="stat-hp" />
      <Bar icon="bolt" label="Stamina" value={s.stamina} tone="stamina" testId="stat-stamina" />
      <Bar icon="food" label="Food" value={s.food} tone="food" testId="stat-food" />
    </div>
  );
}

function Objective() {
  const quest = useGame((s) => s.quest);
  const bag = useGame((s) => s.bag);
  const classroom = useGame((s) => s.settings.classroom);
  const day = dayDef(quest.day);
  const current = day.steps.find((s) => !quest.done.includes(s.id));
  if (!day.steps.length) {
    // Free play after the story: no checklist.
    return (
      <div className="panel objective ui" data-testid="objective">
        <div className="objective-title">
          Day {quest.day}
          <Ja>{quest.day}にちめ</Ja>
        </div>
        <p className="free-play">
          Free time: explore the island!
          <Ja>じゆうに しまを たんけんしよう！</Ja>
        </p>
      </div>
    );
  }
  return (
    <div className="panel objective ui" data-testid="objective">
      <div className="objective-title">
        {day.en}
        <Ja>{day.ja}</Ja>
      </div>
      <ul>
        {day.steps.map((s) => {
          const done = quest.done.includes(s.id);
          const now = s === current;
          const goal = stepGoal(s, classroom);
          return (
            <li key={s.id} className={done ? "done" : now ? "now" : "later"} data-testid={`step-${s.id}`}>
              <span className="tick">{done ? "✓" : now ? "▶" : "•"}</span>
              <span className="step-text">
                {s.en}
                {goal && !done && (
                  <span className="goal">
                    <Icon id={goal.item} size={18} /> {Math.min(count(bag, goal.item), goal.n)}/{goal.n}
                  </span>
                )}
                {now && <Ja>{s.ja}</Ja>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Hint() {
  const hint = useGame((s) => s.hint);
  const touch = useGame((s) => s.touch);
  const mode = useGame((s) => s.mode);
  const ja = useGame((s) => s.settings.japanese);
  const classroom = useGame((s) => s.settings.classroom);
  if (!hint || (mode !== "explore" && mode !== "place")) return null;
  const h = hints(classroom)[hint]?.[touch ? "touch" : "keys"];
  if (!h) return null;
  return (
    <div className="hint ui" data-testid="hint">
      <span>{h.en}</span>
      {ja && (
        <small lang="ja" className="ja">
          {h.ja}
        </small>
      )}
    </div>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const ja = useGame((s) => s.settings.japanese);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.icon && <Icon id={t.icon} size={26} />}
          {t.icons?.map(({ item, n }) => (
            <span key={item}><Icon id={item} size={22} /> ×{n}</span>
          ))}
          <span>
            {t.en}
            {ja && t.ja && (
              <small lang="ja" className="ja">
                {t.ja}
              </small>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function Hotbar() {
  const bag = useGame((s) => s.bag);
  const mode = useGame((s) => s.mode);
  const items = ITEM_ORDER.filter((id) => count(bag, id) > 0);
  const usable = mode === "explore";
  const action = (id: ItemId) => (id === "water" ? "Drink" : id === "fish" ? "Use" : ITEMS[id].food ? "Eat" : ITEMS[id].places ? "Put down" : null);
  return (
    <div className="hotbar ui" data-testid="hotbar" aria-label="Your bag">
      <span className="hotbar-bag" title="Bag">
        <Icon id="bag" size={30} />
      </span>
      {items.length === 0 && <span className="hotbar-empty">empty</span>}
      {items.map((id) => {
        const act = action(id);
        return (
          <button
            key={id}
            className={`slot ${act ? "can" : ""}`}
            disabled={!usable || !act}
            onClick={() => void useItem(id)}
            data-testid={`slot-${id}`}
            title={act ? `${act}: ${ITEMS[id].en}` : ITEMS[id].en}
          >
            <Icon id={id} size={34} />
            <span className="slot-count">{count(bag, id)}</span>
            <span className="slot-word">{ITEMS[id].en}</span>
            {act && <span className="slot-act">{act}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Actions() {
  const mode = useGame((s) => s.mode);
  const needsPulse = useGame((s) => s.needsPulse);
  const craftPulse = useGame((s) => s.craftPulse);
  const unlocked = useGame((s) => s.unlocked);
  const touch = useGame((s) => s.touch);
  const usable = mode === "explore";
  return (
    <div className="actions ui">
      <button className={`action-btn needs ${needsPulse ? "pulse" : ""}`} disabled={!usable} onClick={() => void needs()} data-testid="btn-needs">
        <Icon id="needs" size={34} />
        <span>I need…</span>
        {!touch && <kbd>Q</kbd>}
      </button>
      <button
        className={`action-btn craft ${craftPulse ? "pulse" : ""}`}
        disabled={!usable || unlocked.length === 0}
        onClick={() => openCraft()}
        data-testid="btn-craft"
      >
        <Icon id="craft" size={34} />
        <span>Make</span>
        {!touch && <kbd>C</kbd>}
      </button>
    </div>
  );
}

export function Hud() {
  const screen = useGame((s) => s.screen);
  if (screen !== "game") return null;
  return (
    <>
      <Stats />
      <Objective />
      <Hint />
      <Toasts />
      <Hotbar />
      <Actions />
      <button className="gear ui" onClick={() => setGame({ settingsOpen: true })} aria-label="Settings" data-testid="btn-settings">
        <Icon id="gear" size={28} />
      </button>
    </>
  );
}
