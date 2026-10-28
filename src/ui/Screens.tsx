import { useGame, setGame } from "../game/store";
import { continueGame, newGame, retryStartupMicrophone, teacherUseTapping } from "../game/flow/session";
import { useState } from "react";
import { nextDay } from "../game/flow/days";
import { PHRASES } from "../game/logic/english";
import { dayDef } from "../game/logic/quest";
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

/** Startup-only microphone assistance; no student answer-mode selection. */
export function MicrophoneStartupOverlay() {
  const visible = useGame((s) => s.micStartupProblem);
  const [checking, setChecking] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  if (!visible) return null;
  return (
    <div className="mic-startup-overlay ui" data-testid="mic-startup-overlay">
      <div className="mic-startup-card" role="alertdialog" aria-modal="true" aria-labelledby="mic-startup-heading">
        <div className="mic-startup-symbol"><Icon id="mic" size={42} /></div>
        <h2 id="mic-startup-heading">Microphone unavailable</h2>
        <p className="ja" lang="ja">マイクが つかえません。</p>
        <p className="mic-startup-message">Please ask your teacher for help.</p>
        <p className="mic-startup-ja" lang="ja">せんせいを よんでください。</p>
        <button className="primary big" type="button" disabled={checking} data-testid="mic-retry"
          onClick={() => {
            setChecking(true);
            void retryStartupMicrophone().finally(() => setChecking(false));
          }}>
          {checking ? "Checking…" : "Retry microphone"}
        </button>
        <button className="link mic-teacher-link" type="button" data-testid="teacher-options"
          aria-expanded={teacherOpen} onClick={() => setTeacherOpen((open) => !open)}>
          Teacher options
        </button>
        {teacherOpen && (
          <button className="secondary" type="button" data-testid="teacher-tap" onClick={() => teacherUseTapping()}>
            Continue with tapping (teacher)
          </button>
        )}
      </div>
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
  2: { en: "You made an axe, opened the forest and built a tent.", ja: "おのを つくって、もりを ひらいて、テントを たてたね！", icon: "shelter" },
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
  const said = useGame((s) => s.said);
  const rescued = useGame((s) => s.rescued);
  if (screen !== "dayEnd") return null;
  const rescue = day === 5 && rescued;
  const sentences = rescue ? said : daySaid;
  const done = DAY_DONE[day] ?? { en: "You explored the island.", ja: "しまを たんけんしたね！", icon: "moon" as IconId };
  const next = dayDef(day + 1);
  // "New" only means something next to sentences used before (on Day 1 everything is new).
  const showNew = rescue || daySaid.some((id) => !dayNew.includes(id));
  return (
    <div className="dayend ui" data-testid="dayend" data-rescue={rescue || undefined}>
      <div className="dayend-card">
        <div className="dayend-badge">
          <Icon id={rescue ? "radio" : done.icon} size={56} />
        </div>
        <h2>
          {rescue ? "Rescued!" : `Day ${day} complete!`}
          <Ja>{rescue ? "たすかった！" : `${day}にちめ クリア！`}</Ja>
        </h2>
        <p className="dayend-sub">
          {rescue ? "You and Kai made it home!" : done.en}
          <Ja>{rescue ? "カイと いっしょに いえに かえれたね！" : done.ja}</Ja>
        </p>
        <h3>
          {rescue ? "English you used on your adventure" : "English you used today"}
          <Ja>{rescue ? "ぼうけんで つかった えいご" : "きょう つかった えいご"}</Ja>
        </h3>
        <ul className="said" data-testid="said">
          {sentences.map((id) => (
            <li key={id}>
              <Icon id="check" size={16} /> {PHRASES[id].en}
              {showNew && dayNew.includes(id) && <span className="new">NEW</span>}
            </li>
          ))}
        </ul>
        {!rescue && (
          <p className="next-day">
            {`Next: ${next.steps.length ? next.en : `Day ${day + 1}`}`}
            <Ja>{next.steps.length ? `つぎは ${next.ja}` : `つぎは ${day + 1}にちめ`}</Ja>
          </p>
        )}
        <div className="title-buttons">
          <button className="primary big" onClick={() => void nextDay()} data-testid={rescue ? "keep-exploring" : "next-day"}>
            {rescue ? "Keep exploring" : `Day ${day + 1} →`}
            <Ja>{rescue ? "もっと たんけんする" : `${day + 1}にちめへ`}</Ja>
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
