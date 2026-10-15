import { useGame, setGame } from "../game/store";
import { continueGame, newGame, toTitle } from "../game/flow/session";
import { nextDay } from "../game/flow/days";
import { PHRASES } from "../game/logic/english";
import { dayDef } from "../game/logic/quest";
import { saveSettings } from "../game/store";
import { recognition } from "../audio/recognition";
import { Icon, type IconId } from "./icons";
import { updateSettings } from "./Settings";

function Ja({ children }: { children: React.ReactNode }) {
  const on = useGame((s) => s.settings.japanese);
  if (!on) return null;
  return (
    <small className="ja" lang="ja">
      {children}
    </small>
  );
}

function AnswerMode() {
  const settings = useGame((s) => s.settings);
  const set = (mic: boolean) => {
    const next = { ...settings, mic };
    saveSettings(next);
    setGame({ settings: next });
  };
  return (
    <div className="answer-mode" role="radiogroup" aria-label="How to answer">
      <span className="answer-mode-label">
        Answer by <Ja>こたえかた</Ja>
      </span>
      <button className={`seg ${settings.mic ? "on" : ""}`} onClick={() => set(true)} aria-pressed={settings.mic} data-testid="mode-speak">
        <Icon id="mic" size={22} /> Speaking
        <Ja>はなす</Ja>
      </button>
      <button className={`seg ${!settings.mic ? "on" : ""}`} onClick={() => set(false)} aria-pressed={!settings.mic} data-testid="mode-tap">
        <Icon id="hand" size={22} /> Tapping
        <Ja>えらぶ</Ja>
      </button>
      {!recognition.supported && settings.mic && (
        <p className="note" lang="ja">
          このブラウザでは マイクが つかえません。ぶんを えらんで こたえます。
        </p>
      )}
    </div>
  );
}

function ClassroomMode() {
  const classroom = useGame((s) => s.settings.classroom);
  return (
    <div className="answer-mode">
      <span className="answer-mode-label">
        Classroom mode <Ja>じゅぎょうモード</Ja>
      </span>
      <button
        className={`toggle ${classroom ? "on" : ""}`}
        onClick={() => updateSettings({ classroom: !classroom })}
        aria-label="Classroom mode"
        aria-pressed={classroom}
        data-testid="mode-classroom"
      >
        <span>{classroom ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}

export function TitleScreen() {
  const screen = useGame((s) => s.screen);
  const hasSave = useGame((s) => s.hasSave);
  if (screen !== "title") return null;
  return (
    <div className="title-screen ui" data-testid="title">
      <div className="title-card">
        <h1>
          <span className="t1">Survival</span>
          <span className="t2">Island</span>
        </h1>
        <p className="tagline">
          Explore. Collect. Make. Survive — in English!
          <Ja>しまを たんけんして、えいごで いきのびよう！</Ja>
        </p>
        <div className="title-buttons">
          {hasSave && (
            <button className="primary big" onClick={() => void continueGame()} data-testid="continue">
              Continue <Ja>つづきから</Ja>
            </button>
          )}
          <button className={hasSave ? "secondary big" : "primary big"} onClick={() => void newGame()} data-testid="start">
            {hasSave ? "New game" : "Start"} <Ja>{hasSave ? "はじめから" : "はじめる"}</Ja>
          </button>
        </div>
        <AnswerMode />
        <ClassroomMode />
        <button className="link" onClick={() => setGame({ settingsOpen: true })} data-testid="title-settings">
          <Icon id="gear" size={18} /> Settings
        </button>
      </div>
    </div>
  );
}

/** What each story day achieved, for its card. */
const DAY_DONE: Record<number, { en: string; ja: string; icon: IconId }> = {
  1: { en: "You found food, met Kai and made a fire.", ja: "たべものを みつけて、カイに あって、火を つけたね！", icon: "fire" },
  2: { en: "You made an axe, opened the forest and built a shelter.", ja: "おのを つくって、もりを ひらいて、こやを たてたね！", icon: "shelter" },
  3: { en: "You built a bridge, found water and cooked a fish.", ja: "はしを つくって、みずを みつけて、さかなを やいたね！", icon: "grilledFish" },
  4: { en: "You explored the cave and found an old radio.", ja: "どうくつを たんけんして、ふるい ラジオを みつけたね！", icon: "radio" }
};

/** "Day 2: Make Camp" -> ["Day 2", "Make Camp"]. */
function splitTitle(en: string): [string, string] {
  const i = en.indexOf(": ");
  return i < 0 ? [en, ""] : [en.slice(0, i), en.slice(i + 2)];
}

export function DayEndScreen() {
  const screen = useGame((s) => s.screen);
  const day = useGame((s) => s.quest.day);
  const daySaid = useGame((s) => s.daySaid);
  const dayNew = useGame((s) => s.dayNew);
  if (screen !== "dayEnd") return null;
  const done = DAY_DONE[day] ?? { en: "You explored the island.", ja: "しまを たんけんしたね！", icon: "moon" as IconId };
  const next = dayDef(day + 1);
  // "New" only means something next to sentences used before (on Day 1 everything is new).
  const showNew = daySaid.some((id) => !dayNew.includes(id));
  return (
    <div className="dayend ui" data-testid="dayend">
      <div className="dayend-card">
        <div className="dayend-badge">
          <Icon id={done.icon} size={56} />
        </div>
        <h2>
          Day {day} complete!
          <Ja>{day}にちめ クリア！</Ja>
        </h2>
        <p className="dayend-sub">
          {done.en}
          <Ja>{done.ja}</Ja>
        </p>
        <h3>
          English you used today <Ja>きょう つかった えいご</Ja>
        </h3>
        <ul className="said" data-testid="said">
          {daySaid.map((id) => (
            <li key={id}>
              <Icon id="check" size={16} /> {PHRASES[id].en}
              {showNew && dayNew.includes(id) && <span className="new">NEW</span>}
            </li>
          ))}
        </ul>
        <p className="next-day">
          {`Next: ${next.steps.length ? next.en : `Day ${day + 1}`}`}
          <Ja>{next.steps.length ? `つぎは ${next.ja}` : `つぎは ${day + 1}にちめ`}</Ja>
        </p>
        <div className="title-buttons">
          <button className="primary big" onClick={() => void nextDay()} data-testid="next-day">
            {`Day ${day + 1} →`} <Ja>{`${day + 1}にちめへ`}</Ja>
          </button>
          <button className="secondary big" onClick={() => toTitle()} data-testid="to-title">
            Title <Ja>タイトルへ</Ja>
          </button>
        </div>
      </div>
    </div>
  );
}

/** The new day's name, large, while the player wakes up. */
export function DayTitle() {
  const n = useGame((s) => s.dayTitle);
  if (n === null) return null;
  const def = dayDef(n);
  const [, name] = def.steps.length ? splitTitle(def.en) : ["", "Explore the island!"];
  const ja = def.steps.length ? def.ja : "じゆうに たんけん";
  return (
    <div className="day-title" data-testid="day-title" key={n}>
      <div>
        <span className="day-n">Day {n}</span>
        <span className="day-name">{name}</span>
        <Ja>{ja}</Ja>
      </div>
    </div>
  );
}

/** A starry night between lying down and the day's card. */
export function SleepOverlay() {
  const on = useGame((s) => s.sleeping);
  if (!on) return null;
  return (
    <div className="sleep-overlay" data-testid="sleeping">
      <span className="zzz">Z z z…</span>
    </div>
  );
}
