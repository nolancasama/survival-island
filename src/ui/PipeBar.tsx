import { useGame } from "../game/store";
import { NOTCHES } from "../game/logic/waterworks";
import {
  addFromJoint, confirmPiece, cycleLength, nudgeNotch, stopPipe, takeOffPiece, turnPiece, undoPiece
} from "../game/flow/chapter3";
import { Icon } from "./icons";

/**
 * Chapter 3 building controls (mouse, touchpad and touch). Laying: walk to aim
 * the new piece, then long/short, the new post's height, put. Changing a post:
 * higher, lower, turn or take off the last piece, add a pipe. Every button
 * carries its English word; none of them needs speech.
 */

function Ja({ children }: { children: React.ReactNode }) {
  const on = useGame((s) => s.settings.japanese);
  return on ? <small className="ja" lang="ja">{children}</small> : null;
}

/** The post's height as five notches, the current one filled. */
function Notches({ n }: { n: number }) {
  return (
    <span className="notches" aria-label={`post ${NOTCHES[n]} m`} data-testid="notches" data-notch={n}>
      {NOTCHES.map((_, i) => <i key={i} className={i === n ? "on" : i < n ? "below" : ""} />)}
    </span>
  );
}

function Btn({ label, word, keyName, onClick, testid, disabled, className = "" }: {
  label: string; word: string; keyName: string; onClick: () => void; testid: string; disabled?: boolean; className?: string;
}) {
  const touch = useGame((s) => s.touch);
  return (
    <button className={`round word ${className}`} onClick={onClick} disabled={disabled} aria-label={word} data-testid={testid}>
      <span className="glyph" aria-hidden>{label}</span>
      <span className="btn-word">{word}</span>
      {!touch && <kbd>{keyName}</kbd>}
    </button>
  );
}

const PROBLEM: Record<string, string> = {
  water: "Not in the water!",
  edge: "No ground for the post.",
  blocked: "Something is in the way.",
  crowded: "Too close to a post.",
  ground: "It hits the ground!"
};

export function PipeBar() {
  const mode = useGame((s) => s.mode);
  const pipe = useGame((s) => s.pipe);
  const poles = useGame((s) => (s.bag.pole ?? 0));
  const shortPoles = useGame((s) => (s.bag.shortPole ?? 0));
  if (mode !== "pipe" || !pipe) return null;
  if (pipe.kind === "edit") {
    return (
      <div className="panel placebar pipebar ui" data-testid="joint-panel">
        <Icon id="pipe" size={38} />
        <div className="place-text">
          <strong>This post <Notches n={pipe.notch} /></strong>
          <Ja>はしらの たかさを かえよう</Ja>
        </div>
        <Btn label="▲" word="higher" keyName="X" onClick={() => nudgeNotch(1)} testid="joint-higher" />
        <Btn label="▼" word="lower" keyName="Z" onClick={() => nudgeNotch(-1)} testid="joint-lower" />
        {pipe.canTurn && <Btn label="↺" word="turn" keyName="Q" onClick={() => void turnPiece(-1)} testid="joint-turn-left" />}
        {pipe.canTurn && <Btn label="↻" word="turn" keyName="R" onClick={() => void turnPiece(1)} testid="joint-turn-right" />}
        <Btn label="✂" word="take off" keyName="Del" onClick={() => takeOffPiece()} testid="joint-takeoff" />
        {pipe.canAdd && <Btn label="＋" word="add" keyName="E" onClick={() => addFromJoint()} testid="joint-add" className="ok" />}
        <Btn label="✕" word="done" keyName="Esc" onClick={() => stopPipe()} testid="joint-done" className="cancel" />
      </div>
    );
  }
  const status = pipe.problem
    ? <span className="bad">{PROBLEM[pipe.problem]}</span>
    : pipe.underRim
      ? <span className="bad">Under the top. Make it higher!</span>
      : pipe.slope === "up"
        ? <span className="warn" data-testid="slope-up">↗ The water can't go up!</span>
        : pipe.snap
          ? <span className="good">Connect them!</span>
          : <span className="good">{pipe.slope === "down" ? "↘ The water goes down." : "→ It's level."}</span>;
  return (
    <div className="panel placebar pipebar ui" data-testid="pipe-bar" data-problem={pipe.problem ?? ""} data-slope={pipe.slope}>
      <Icon id="pipe" size={38} />
      <div className="place-text">
        <strong>Build a pipe. <Notches n={pipe.notch} /></strong>
        {status}
        <Ja>あるいて むきを きめよう ・ ぼう {poles} / みじかい ぼう {shortPoles}</Ja>
      </div>
      <Btn label={pipe.len === "long" ? "━━" : "━"} word={pipe.len} keyName="T" onClick={() => cycleLength()} testid="pipe-len" />
      <Btn label="▲" word="higher" keyName="X" onClick={() => nudgeNotch(1)} testid="pipe-higher" />
      <Btn label="▼" word="lower" keyName="Z" onClick={() => nudgeNotch(-1)} testid="pipe-lower" />
      <Btn label="↶" word="back" keyName="⌫" onClick={() => undoPiece()} testid="pipe-undo" />
      <Btn label="✓" word="put" keyName="E" onClick={() => void confirmPiece()} testid="pipe-put" className="ok" />
      <Btn label="✕" word="done" keyName="Esc" onClick={() => stopPipe()} testid="pipe-done" className="cancel" />
    </div>
  );
}
