import { useGame } from "../game/store";
import { cancelAsk, choose, micPress, nextLine, replay, micUsable } from "../game/flow/ask";
import { Icon } from "./icons";
import { Portrait, SPEAKER_NAME } from "./Portrait";
import { UI } from "./i18n";

function Ja({ children }: { children: React.ReactNode }) {
  const on = useGame((s) => s.settings.japanese);
  if (!on || !children) return null;
  return (
    <small className="ja" lang="ja">
      {children}
    </small>
  );
}

/** An English prompt: say the sentence (or choose it). */
export function PromptPanel() {
  const p = useGame((s) => s.prompt);
  const touch = useGame((s) => s.touch);
  useGame((s) => s.micState); // re-render when the mic gets blocked
  if (!p) return null;
  const mic = micUsable();
  const speakHint = touch ? UI.speakTouch : UI.speakKeys;
  const status =
    p.status === "listening"
      ? UI.listening
      : p.status === "miss"
        ? p.misses >= 2 && p.misses < 3
          ? UI.listen
          : p.buttons && mic
            ? UI.rescue
            : UI.tryAgain
        : p.status === "unclear"
          ? UI.unclear
          : p.status === "wrong"
            ? UI.wrong
            : p.buttons
              ? UI.choose
              : speakHint;
  const showSentences = !p.buttons;
  return (
    <div className={`panel prompt ui ${p.status}`} data-testid="prompt" role="dialog" aria-label="English">
      {p.question && (
        <div className="prompt-question">
          {p.question.by !== "game" && <Portrait by={p.question.by} size={52} />}
          <div className="q-text">
            {p.question.by !== "game" && <span className="who">{SPEAKER_NAME[p.question.by]}</span>}
            <span className="q-en" data-testid="prompt-question">
              {p.question.en}
            </span>
            <Ja>{p.question.ja}</Ja>
          </div>
        </div>
      )}
      <div className="prompt-main">
        {p.picture && (
          <div className="prompt-picture" aria-hidden="true">
            <Icon id={p.picture} size={64} />
          </div>
        )}
        <div className="prompt-body">
          {showSentences && (
            <ol className={`sentences ${p.sentences.length > 1 ? "many" : "one"}`}>
              {p.sentences.map((s) => (
                <li
                  key={s.id}
                  className={`sentence ${p.matched === s.id ? "matched" : ""} ${p.reading ? "reading" : ""}`}
                  data-testid="sentence"
                >
                  {s.en}
                </li>
              ))}
            </ol>
          )}
          {p.buttons && (
            <div className="choices" role="group">
              {p.choices.map((c, i) => (
                <button
                  key={c.id}
                  className={`choice ${p.wrongId === c.id ? "wrong" : ""} ${p.matched === c.id ? "matched" : ""}`}
                  onClick={() => choose(c.id)}
                  data-testid="choice"
                  data-id={c.id}
                >
                  <kbd>{i + 1}</kbd>
                  {c.en}
                </button>
              ))}
            </div>
          )}
          <div className="prompt-controls">
            {mic && p.status !== "correct" && (
              <button
                className={`mic ${p.status === "listening" ? "on" : ""}`}
                onClick={() => micPress()}
                aria-label="Speak"
                data-testid="mic"
              >
                <Icon id="mic" size={30} />
                {!touch && <kbd>SPACE</kbd>}
              </button>
            )}
            <button className="speaker" onClick={() => void replay()} aria-label="Listen again" data-testid="replay">
              <Icon id="speaker" size={26} />
            </button>
            <div className="prompt-status" data-testid="prompt-status">
              {p.status === "correct" ? (
                <span className="good">
                  <Icon id="check" size={26} /> Great!
                </span>
              ) : (
                <>
                  <span>{status.en}</span>
                  <Ja>{status.ja}</Ja>
                </>
              )}
              {p.heard && p.status !== "ready" && (
                <span className="heard" data-testid="heard">
                  “{p.heard}”
                </span>
              )}
            </div>
          </div>
        </div>
        {p.cancellable && p.status !== "correct" && (
          <button className="close" onClick={() => cancelAsk()} aria-label="Close" data-testid="prompt-close">
            <Icon id="close" size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

/** A line of dialogue (Kai, your thoughts, the story). */
export function DialoguePanel() {
  const line = useGame((s) => s.line);
  const touch = useGame((s) => s.touch);
  if (!line) return null;
  return (
    <div className={`panel dialogue ui by-${line.by}`} onClick={() => nextLine()} data-testid="dialogue" role="dialog">
      <Portrait by={line.by} size={64} />
      <div className="dialogue-body">
        {line.by !== "game" && <span className="who">{SPEAKER_NAME[line.by]}</span>}
        <p className="line-en" data-testid="line">
          {line.en}
        </p>
        {line.icons && (
          <div className="line-icons">
            {line.icons.map((ic) => (
              <span key={ic.item} className="line-icon">
                <Icon id={ic.item} size={30} /> × {ic.n}
              </span>
            ))}
          </div>
        )}
        {!line.target && <Ja>{line.ja}</Ja>}
      </div>
      <button
        className="next"
        onClick={(e) => {
          e.stopPropagation();
          nextLine();
        }}
        data-testid="next"
      >
        ▶ {UI.next.en}
        {!touch && <kbd>E</kbd>}
      </button>
    </div>
  );
}
