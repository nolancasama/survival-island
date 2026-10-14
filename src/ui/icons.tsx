import type { ReactElement } from "react";
import type { ItemId } from "../game/types";

/**
 * Inline SVG icons: chunky, outlined, readable at 28 px. No emoji or icon
 * fonts, so they look the same on every Chromebook, iPad and Android tablet.
 */

export type IconId =
  | ItemId
  | "fire"
  | "tummy"
  | "box"
  | "heart"
  | "bolt"
  | "food"
  | "craft"
  | "needs"
  | "mic"
  | "speaker"
  | "check"
  | "lock"
  | "sign"
  | "eat"
  | "bag"
  | "gear"
  | "rotate"
  | "close"
  | "hand"
  | "run"
  | "tree"
  | "bridge"
  | "moon";

const O = "#3b2a1c"; // outline
const SW = 2.6;

const P: Record<IconId, ReactElement> = {
  bridge: (
    <g stroke={O} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 34 Q14 28 24 34 T44 34" fill="none" stroke="#559fb6" />
      <path d="M7 27 L16 19 H33 L42 27 Z" fill="#c58e53" />
      <path d="M13 22 V10 M36 22 V10 M7 29 V17 M42 29 V17" fill="none" />
      <path d="M13 13 H36 M7 20 H42 M17 20 L14 26 M24 20 V26 M31 20 L34 26" fill="none" />
    </g>
  ),
  wood: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <rect x="5" y="26" width="34" height="11" rx="5.5" fill="#a8693a" transform="rotate(-14 22 31)" />
      <ellipse cx="39" cy="26.5" rx="4.6" ry="5.6" fill="#e9c28a" transform="rotate(-14 39 26.5)" />
      <rect x="9" y="12" width="32" height="11" rx="5.5" fill="#c07f45" transform="rotate(10 25 17)" />
      <ellipse cx="40" cy="19.5" rx="4.6" ry="5.6" fill="#f0cf98" transform="rotate(10 40 19.5)" />
      <circle cx="40" cy="19.5" r="1.6" fill="none" stroke="#b07a42" strokeWidth={1.4} />
    </g>
  ),
  stone: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M8 34 L12 18 L24 10 L37 15 L42 30 L33 39 L15 40 Z" fill="#a3a9b3" />
      <path d="M14 20 L24 14 L31 17" fill="none" stroke="#e1e5ec" strokeWidth={3} strokeLinecap="round" />
      <path d="M33 39 L42 30 L37 15" fill="none" stroke="#7d838e" strokeWidth={0} />
    </g>
  ),
  coconut: (
    <g stroke={O} strokeWidth={SW}>
      <circle cx="24" cy="25" r="15" fill="#8a5a33" />
      <path d="M13 21 Q18 14 26 13" fill="none" stroke="#b98556" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx="19" cy="26" r="2.2" fill="#3b2414" stroke="none" />
      <circle cx="27" cy="26" r="2.2" fill="#3b2414" stroke="none" />
      <circle cx="23" cy="32" r="2.2" fill="#3b2414" stroke="none" />
    </g>
  ),
  eat: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M6 22 A18 18 0 0 0 42 22 Z" fill="#8a5a33" />
      <path d="M10 22 A14 14 0 0 0 38 22 Z" fill="#fbf6ea" />
      <path d="M17 12 q3 -4 6 0 q3 4 6 0" fill="none" strokeLinecap="round" />
    </g>
  ),
  rope: (
    <g stroke={O} strokeWidth={SW} fill="none">
      <circle cx="24" cy="24" r="15" fill="#d9b779" />
      <circle cx="24" cy="24" r="10" stroke="#9b7a44" strokeWidth={2.2} />
      <circle cx="24" cy="24" r="5" stroke="#9b7a44" strokeWidth={2.2} />
      <path d="M36 33 Q42 38 40 44" strokeLinecap="round" />
    </g>
  ),
  leaves: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M8 40 Q8 12 40 8 Q38 38 8 40 Z" fill="#58b84a" />
      <path d="M8 40 L32 16" fill="none" stroke="#2f7a2a" strokeWidth={2} />
    </g>
  ),
  fish: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M6 24 Q20 10 34 24 Q20 38 6 24 Z" fill="#5aa7e0" />
      <path d="M33 24 L43 15 L43 33 Z" fill="#3d86c0" />
      <circle cx="14" cy="22" r="2" fill={O} stroke="none" />
    </g>
  ),
  grilledFish: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M6 24 Q20 10 34 24 Q20 38 6 24 Z" fill="#d98a3d" />
      <path d="M33 24 L43 15 L43 33 Z" fill="#b8692a" />
      <path d="M15 18 L19 30 M21 16 L25 31 M27 18 L30 28" fill="none" stroke="#6b3a17" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx="11" cy="22" r="1.8" fill={O} stroke="none" />
    </g>
  ),
  water: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M24 6 Q38 24 36 31 A12 12 0 0 1 12 31 Q10 24 24 6 Z" fill="#59b6f0" />
      <path d="M17 30 Q17 36 22 37" fill="none" stroke="#d8f0ff" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  ),
  metal: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M8 16 L30 9 L40 30 L18 39 Z" fill="#b9c2cc" />
      <circle cx="16" cy="19" r="2" fill="#6b737d" />
      <circle cx="30" cy="31" r="2" fill="#6b737d" />
    </g>
  ),
  axe: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <rect x="22" y="8" width="5" height="34" rx="2.5" fill="#b0743f" transform="rotate(20 24 25)" />
      <path d="M14 8 L30 11 L28 22 L12 20 Q8 14 14 8 Z" fill="#a3a9b3" />
    </g>
  ),
  rod: (
    <g stroke={O} strokeWidth={SW} fill="none" strokeLinecap="round">
      <path d="M8 42 L36 8" stroke="#b0743f" strokeWidth={4} />
      <path d="M36 8 Q42 22 40 34" strokeWidth={1.6} />
      <circle cx="40" cy="36" r="2.4" fill="#e8483f" />
    </g>
  ),
  container: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M8 18 Q8 40 24 40 Q40 40 40 18 Z" fill="#8a5a33" />
      <ellipse cx="24" cy="18" rx="16" ry="5" fill="#59b6f0" />
    </g>
  ),
  torch: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <rect x="21" y="20" width="6" height="24" rx="2" fill="#b0743f" />
      <path d="M24 4 Q34 14 30 22 L18 22 Q14 14 24 4 Z" fill="#ff9a2f" />
      <path d="M24 11 Q29 17 27 21 L21 21 Q19 17 24 11 Z" fill="#ffe066" stroke="none" />
    </g>
  ),
  campfire: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <ellipse cx="24" cy="36" rx="18" ry="6" fill="#d8c29a" />
      <rect x="9" y="26" width="30" height="7" rx="3.5" fill="#a8693a" transform="rotate(-18 24 30)" />
      <rect x="9" y="26" width="30" height="7" rx="3.5" fill="#c07f45" transform="rotate(18 24 30)" />
      {[8, 16, 24, 32, 40].map((x, i) => (
        <circle key={i} cx={x} cy={37 + (i % 2) * 2} r="3.4" fill="#a3a9b3" />
      ))}
    </g>
  ),
  fire: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M24 4 Q40 18 36 32 A12 12 0 0 1 12 32 Q10 22 18 14 Q19 22 23 22 Q20 12 24 4 Z" fill="#ff8a2a" />
      <path d="M24 20 Q32 28 29 34 A5.5 5.5 0 0 1 19 34 Q18 28 24 20 Z" fill="#ffe066" stroke="none" />
    </g>
  ),
  shelter: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M4 40 L24 8 L44 40 Z" fill="#58b84a" />
      <path d="M17 40 L24 28 L31 40 Z" fill="#3b2a1c" />
    </g>
  ),
  signalFire: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M18 8 Q14 4 20 2 M26 10 Q22 6 28 3" fill="none" stroke="#9aa3ad" strokeLinecap="round" />
      <path d="M24 12 Q38 24 34 34 A10 10 0 0 1 14 34 Q12 24 24 12 Z" fill="#ff6a2a" />
      <rect x="10" y="38" width="28" height="6" rx="2" fill="#a8693a" />
    </g>
  ),
  tummy: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <circle cx="24" cy="24" r="17" fill="#ffd58a" />
      <circle cx="18" cy="20" r="2.2" fill={O} stroke="none" />
      <circle cx="30" cy="20" r="2.2" fill={O} stroke="none" />
      <path d="M16 31 q2 -3 4 0 q2 3 4 0 q2 -3 4 0 q2 3 4 0" fill="none" strokeLinecap="round" />
      <path d="M38 8 q4 2 2 5 M42 14 q3 2 1 4" fill="none" stroke="#e8483f" strokeLinecap="round" strokeWidth={2} />
    </g>
  ),
  box: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <rect x="7" y="13" width="34" height="27" rx="2" fill="#c08a4a" />
      <path d="M7 22 H41 M7 31 H41" stroke="#8a5a2c" strokeWidth={2} />
      <rect x="5" y="9" width="38" height="7" rx="2" fill="#d79c58" />
    </g>
  ),
  heart: (
    <path
      d="M24 41 L9 26 A8.5 8.5 0 0 1 24 14 A8.5 8.5 0 0 1 39 26 Z"
      fill="#ef4b5a"
      stroke={O}
      strokeWidth={SW}
      strokeLinejoin="round"
    />
  ),
  bolt: <path d="M28 4 L10 27 L22 27 L18 44 L38 19 L26 19 Z" fill="#ffcf33" stroke={O} strokeWidth={SW} strokeLinejoin="round" />,
  food: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M24 14 Q34 6 40 16 Q46 30 34 40 Q28 43 24 40 Q20 43 14 40 Q2 30 8 16 Q14 6 24 14 Z" fill="#f36c3d" />
      <path d="M24 14 Q25 8 30 5" fill="none" strokeLinecap="round" />
      <path d="M13 20 Q12 26 15 30" fill="none" stroke="#ffd2b8" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  ),
  craft: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <rect x="21" y="16" width="6" height="28" rx="2.5" fill="#b0743f" transform="rotate(-35 24 30)" />
      <rect x="10" y="7" width="22" height="11" rx="2" fill="#a3a9b3" transform="rotate(-35 21 12)" />
    </g>
  ),
  needs: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M6 10 H42 V32 H22 L12 41 V32 H6 Z" fill="#fff6e0" />
      <circle cx="16" cy="21" r="2.4" fill={O} stroke="none" />
      <circle cx="24" cy="21" r="2.4" fill={O} stroke="none" />
      <circle cx="32" cy="21" r="2.4" fill={O} stroke="none" />
    </g>
  ),
  mic: (
    <g stroke="currentColor" strokeWidth={3.2} fill="none" strokeLinecap="round">
      <rect x="17" y="5" width="14" height="24" rx="7" fill="currentColor" />
      <path d="M11 22 a13 13 0 0 0 26 0 M24 35 V43 M17 43 H31" />
    </g>
  ),
  speaker: (
    <g stroke="currentColor" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 18 H16 L26 9 V39 L16 30 H8 Z" fill="currentColor" />
      <path d="M32 17 a9 9 0 0 1 0 14 M36 11 a17 17 0 0 1 0 26" />
    </g>
  ),
  check: <path d="M9 25 L20 36 L40 12" fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />,
  lock: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M15 22 V15 a9 9 0 0 1 18 0 V22" fill="none" />
      <rect x="10" y="21" width="28" height="21" rx="4" fill="#ffcf33" />
    </g>
  ),
  sign: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <rect x="21" y="18" width="6" height="26" fill="#a8693a" />
      <path d="M6 8 H36 L43 16 L36 24 H6 Z" fill="#d79c58" />
    </g>
  ),
  bag: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M17 14 Q17 6 24 6 Q31 6 31 14" fill="none" />
      <path d="M8 16 H40 L37 42 H11 Z" fill="#d79c58" />
      <path d="M16 24 H32" stroke="#8a5a2c" />
    </g>
  ),
  gear: (
    <g fill="currentColor">
      <path d="M21 4 h6 l1 6 a14 14 0 0 1 4 2 l5 -3 4 4 -3 5 a14 14 0 0 1 2 4 l6 1 v6 l-6 1 a14 14 0 0 1 -2 4 l3 5 -4 4 -5 -3 a14 14 0 0 1 -4 2 l-1 6 h-6 l-1 -6 a14 14 0 0 1 -4 -2 l-5 3 -4 -4 3 -5 a14 14 0 0 1 -2 -4 l-6 -1 v-6 l6 -1 a14 14 0 0 1 2 -4 l-3 -5 4 -4 5 3 a14 14 0 0 1 4 -2 Z M24 17 a7 7 0 1 0 0.01 0 Z" fillRule="evenodd" />
    </g>
  ),
  rotate: (
    <g stroke="currentColor" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M38 24 A14 14 0 1 1 30 11" />
      <path d="M28 4 L32 12 L23 14" />
    </g>
  ),
  close: <path d="M12 12 L36 36 M36 12 L12 36" stroke="currentColor" strokeWidth={5.5} strokeLinecap="round" />,
  hand: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M14 24 V12 a3 3 0 0 1 6 0 V22 V8 a3 3 0 0 1 6 0 V22 V10 a3 3 0 0 1 6 0 V24 V16 a3 3 0 0 1 6 0 V30 Q38 44 26 44 Q16 44 12 36 L7 27 a3 3 0 0 1 5 -3 Z" fill="#ffd8b5" />
    </g>
  ),
  run: (
    <g stroke="currentColor" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="30" cy="8" r="4" fill="currentColor" />
      <path d="M14 20 L24 15 L32 22 L38 22 M24 15 L20 30 L28 36 L26 44 M20 30 L12 40" />
    </g>
  ),
  /** A standing tree (the ones the axe cuts). */
  tree: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <rect x="20" y="28" width="8" height="15" rx="2" fill="#a8693a" />
      <circle cx="24" cy="17" r="12" fill="#4fae4a" />
      <circle cx="15" cy="25" r="7.5" fill="#3f9a3f" />
      <circle cx="33" cy="25" r="7.5" fill="#3f9a3f" />
      <path d="M18 12 Q22 8 27 9" fill="none" stroke="#8fd77f" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  ),
  /** Night and sleeping. */
  moon: (
    <g stroke={O} strokeWidth={SW} strokeLinejoin="round">
      <path d="M30 6 A17 17 0 1 0 42 32 A13 13 0 1 1 30 6 Z" fill="#ffe27a" />
      <path d="M36 9 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4 Z" fill="#fff6c4" strokeWidth={1.4} />
    </g>
  )
};

export function Icon({ id, size = 32, className }: { id: IconId; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      {P[id]}
    </svg>
  );
}
