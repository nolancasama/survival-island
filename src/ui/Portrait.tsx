import type { Speaker } from "../game/store";

/** Round character portraits for dialogue and prompts. */
export function Portrait({ by, size = 64 }: { by: Speaker; size?: number }) {
  if (by === "game") {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#7fd3f0" stroke="#3b2a1c" strokeWidth="3" />
        <path d="M6 40 Q20 34 32 40 T58 40 V46 Q44 58 32 60 Q14 58 6 46 Z" fill="#2aa2c9" />
        <path d="M18 40 Q22 28 34 26 Q46 28 48 40 Z" fill="#f2dcaa" stroke="#3b2a1c" strokeWidth="2.5" />
        <path d="M33 26 Q32 16 36 10" fill="none" stroke="#8a6238" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 10 Q28 8 24 13 M36 10 Q44 6 48 11 M36 10 Q40 16 44 20 M36 10 Q30 15 28 20" fill="none" stroke="#3f9a3b" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  const kai = by === "kai";
  const skin = kai ? "#c58b5c" : "#f3c9a1";
  const hair = kai ? "#1e1612" : "#3a261a";
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill={kai ? "#9be0b0" : "#a8d8ff"} stroke="#3b2a1c" strokeWidth="3" />
      <path d="M12 62 Q14 46 32 46 Q50 46 52 62 Z" fill={kai ? "#3e9b5a" : "#3f9fe0"} stroke="#3b2a1c" strokeWidth="2.5" />
      <circle cx="32" cy="30" r="15" fill={skin} stroke="#3b2a1c" strokeWidth="2.5" />
      <path d="M17 28 Q18 13 32 13 Q46 13 47 28 Q40 20 32 21 Q24 20 17 28 Z" fill={hair} />
      {kai ? (
        <path d="M17 24 Q32 16 47 24 L47 28 Q32 20 17 28 Z" fill="#ff8a2a" stroke="#3b2a1c" strokeWidth="1.5" />
      ) : (
        <>
          <path d="M16 24 Q18 10 32 10 Q46 10 48 24 Q32 18 16 24 Z" fill="#ef5b3a" stroke="#3b2a1c" strokeWidth="2" />
          <path d="M30 20 Q44 17 54 22 Q46 24 32 23 Z" fill="#ef5b3a" stroke="#3b2a1c" strokeWidth="2" />
        </>
      )}
      <circle cx="26" cy="31" r="2.2" fill="#1d1712" />
      <circle cx="38" cy="31" r="2.2" fill="#1d1712" />
      <circle cx="22" cy="36" r="2.4" fill="#ff9a8a" opacity="0.7" />
      <circle cx="42" cy="36" r="2.4" fill="#ff9a8a" opacity="0.7" />
      <path d="M27 37 Q32 41 37 37" fill="none" stroke="#8a3a2a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export const SPEAKER_NAME: Record<Speaker, string> = { kai: "Kai", self: "You", game: "" };
