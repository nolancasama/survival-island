import { useGame, setGame } from "../game/store";
import { continueGame, keepPlaying, newGame, toTitle } from "../game/flow/session";
import { PHRASES } from "../game/logic/english";
import { saveSettings } from "../game/store";
import { recognition } from "../audio/recognition";
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
        <button className="link" onClick={() => setGame({ settingsOpen: true })} data-testid="title-settings">
          <Icon id="gear" size={18} /> Settings
        </button>
      </div>
    </div>
  );
}

export function DayEndScreen() {
  const screen = useGame((s) => s.screen);
  const said = useGame((s) => s.said);
  if (screen !== "dayEnd") return null;
  return (
    <div className="dayend ui" data-testid="dayend">
      <div className="dayend-card">
        <div className="dayend-badge">
          <Icon id="fire" size={56} />
        </div>
        <h2>
          Day 1 complete!
          <Ja>1にちめ クリア！</Ja>
        </h2>
        <p className="dayend-sub">
          You found food, met Kai and made a fire.
          <Ja>たべものを みつけて、カイに あって、火を つけたね！</Ja>
        </p>
        <h3>
          English you used <Ja>つかった えいご</Ja>
        </h3>
        <ul className="said" data-testid="said">
          {said.map((id) => (
            <li key={id}>
              <Icon id="check" size={16} /> {PHRASES[id].en}
            </li>
          ))}
        </ul>
        <p className="next-day">
          Next: Day 2 — The Forest (coming soon)
          <Ja>つぎは 2にちめ: もりへ（じゅんびちゅう）</Ja>
        </p>
        <div className="title-buttons">
          <button className="primary big" onClick={() => keepPlaying()} data-testid="keep-playing">
            Keep playing <Ja>つづけて あそぶ</Ja>
          </button>
          <button className="secondary big" onClick={() => toTitle()} data-testid="to-title">
            Title <Ja>タイトルへ</Ja>
          </button>
        </div>
      </div>
    </div>
  );
}
