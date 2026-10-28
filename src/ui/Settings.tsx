import { useGame, setGame, saveSettings, type Settings } from "../game/store";
import { refreshQuest, toTitle } from "../game/flow/session";
import { audio } from "../audio/audio";
import { tts } from "../audio/tts";

function Row({ label, ja, children }: { label: string; ja: string; children: React.ReactNode }) {
  return (
    <label className="setting-row">
      <span className="setting-label">
        {label}
        <small lang="ja">{ja}</small>
      </span>
      {children}
    </label>
  );
}

function Toggle({ value, onChange, testId }: { value: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button type="button" className={`toggle ${value ? "on" : ""}`} onClick={() => onChange(!value)} aria-pressed={value} data-testid={testId}>
      <span>{value ? "ON" : "OFF"}</span>
    </button>
  );
}

export function updateSettings(patch: Partial<Settings>) {
  const s = { ...useGame.getState().settings, ...patch };
  saveSettings(s);
  setGame({ settings: s });
  if (patch.classroom !== undefined && useGame.getState().screen === "game") refreshQuest();
  audio.setVolumes(s.music, s.sfx);
  tts.setRate(s.slowVoice ? 0.8 : 1);
}

export function SettingsModal() {
  const open = useGame((s) => s.settingsOpen);
  const s = useGame((st) => st.settings);
  const screen = useGame((st) => st.screen);
  if (!open) return null;
  return (
    <div className="modal-backdrop ui" onClick={() => setGame({ settingsOpen: false })}>
      <div className="modal" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()} data-testid="settings-modal">
        <h2>
          Settings <small lang="ja">せってい</small>
        </h2>
        <Row label="Classroom mode" ja="じゅぎょうモード">
          <Toggle value={s.classroom} onChange={(v) => updateSettings({ classroom: v })} testId="toggle-classroom" />
        </Row>
        <Row label="Music volume" ja="おんがく">
          <input type="range" min={0} max={1} step={0.05} value={s.music} onChange={(e) => updateSettings({ music: Number(e.target.value) })} />
        </Row>
        <Row label="Sound effects volume" ja="こうかおん">
          <input type="range" min={0} max={1} step={0.05} value={s.sfx} onChange={(e) => updateSettings({ sfx: Number(e.target.value) })} />
        </Row>
        <Row label="Japanese help" ja="にほんごの ヒント">
          <Toggle value={s.japanese} onChange={(v) => updateSettings({ japanese: v })} testId="toggle-ja" />
        </Row>
        <Row label="Slow English voice" ja="ゆっくり よむ">
          <Toggle value={s.slowVoice} onChange={(v) => updateSettings({ slowVoice: v })} />
        </Row>
        <Row label="Camera speed" ja="カメラの はやさ">
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.1}
            value={s.cameraSensitivity}
            onChange={(e) => updateSettings({ cameraSensitivity: Number(e.target.value) })}
          />
        </Row>
        <div className="modal-buttons">
          {screen !== "title" && (
            <button className="secondary" onClick={() => toTitle()} data-testid="settings-title">
              Save &amp; title <small lang="ja">セーブして タイトルへ</small>
            </button>
          )}
          <button className="primary" onClick={() => setGame({ settingsOpen: false })} data-testid="settings-close">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
