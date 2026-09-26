import { For, Show } from "solid-js";
import type { Settings } from "../tuning/settings";
import { tuningsFor } from "../tuning/settings";
import "./pedal.css";

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;

const PC: Record<string, number> = {
  C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4,
  F: 5, "F#": 6, GB: 6, G: 7, "G#": 8, AB: 8,
  A: 9, "A#": 10, BB: 10, B: 11,
};

function midiOf(note: string, octave: number) {
  const key = note.trim().replace("♯", "#").replace("♭", "b").toUpperCase();
  return (octave + 1) * 12 + (PC[key] ?? 4);
}

function nameOf(midi: number) {
  const n = ((midi % 12) + 12) % 12;
  return `${NAMES[n]}${Math.floor(midi / 12) - 1}`;
}

export function Pedal(props: {
  power: boolean;
  face: boolean;
  note: string;
  octave: number;
  cents: number;
  hz: number;
  status: string;
  settings: Settings;
  onPower: () => void;
  onSetup: () => void;
  onBack: () => void;
  onA4: (hz: number) => void;
  onMode: (mode: string) => void;
  onTuning: (id: string) => void;
}) {
  const neighbors = () => {
    const m = midiOf(props.note, props.octave);
    return [-2, -1, 0, 1, 2].map((d) => ({
      midi: m + d,
      at: (d + 2) * 100,
      label: nameOf(m + d),
    }));
  };
  const centsText = () => {
    const n = Math.round(props.cents);
    return `${n > 0 ? "+" : ""}${n}¢`;
  };

  return (
    <div class="stage">
      <div class="flip">
        <div class={["rotor", { back: props.face }]}>
          <div class={["pedal", "front", { on: props.power }]} inert={props.face}>
            <Screws />
            <div class={["window", { on: props.power }]} style={`--cents: ${props.cents}`}>
              <div class="card">
                <div class="meter" aria-hidden="true">
                  <div class="scale">
                    <For each={neighbors()} keyed={(n) => n.midi}>
                      {(n) => (
                        <span class="mark" style={`left: calc(${n().at} * var(--px))`}>
                          {n().label}
                        </span>
                      )}
                    </For>
                  </div>
                  <div class="needle" />
                </div>
                <div class="figures" aria-live="polite">
                  <span class="now">
                    {props.note}
                    {props.octave}
                  </span>
                  <span class="cents">{centsText()}</span>
                  <span class="hz">{props.hz.toFixed(2)} Hz</span>
                </div>
              </div>
            </div>
            <p class="wordmark">MIZUTUNE</p>
            <div class="switches">
              <div class="switch-col">
                <span class={["led", { on: props.power }]} />
                <Footswitch label="Power" pressed={props.power} onClick={() => props.onPower()} />
              </div>
              <div class="switch-col">
                <span class="led spacer" />
                <Footswitch label="Setup" onClick={() => props.onSetup()} />
              </div>
            </div>
            <p class="status">{props.status}</p>
          </div>

          <div class="pedal rear" inert={!props.face}>
            <Screws />
            <div class="settings">
              <label class="field">
                A4
                <input
                  type="number"
                  min="430"
                  max="450"
                  step="1"
                  value={props.settings.a4}
                  onInput={(e) => {
                    const n = Number(e.currentTarget.value);
                    if (n >= 430 && n <= 450) props.onA4(n);
                  }}
                  onChange={(e) => props.onA4(Number(e.currentTarget.value))}
                />
              </label>
              <label class="field">
                Mode
                <select onChange={(e) => props.onMode(e.currentTarget.value)}>
                  <option value="chromatic" selected={props.settings.mode === "chromatic"}>
                    Chromatic
                  </option>
                  <option value="guitar" selected={props.settings.mode === "guitar"}>
                    Guitar
                  </option>
                  <option value="ukulele" selected={props.settings.mode === "ukulele"}>
                    Ukulele
                  </option>
                </select>
              </label>
              <label class="field">
                Tuning
                <select
                  disabled={props.settings.mode === "chromatic"}
                  onChange={(e) => props.onTuning(e.currentTarget.value)}
                >
                  <Show when={props.settings.mode === "chromatic"}>
                    <option value="">—</option>
                  </Show>
                  <For each={tuningsFor(props.settings.mode)}>
                    {(t) => (
                      <option value={t.id} selected={t.id === props.settings.tuningId}>
                        {t.label}
                      </option>
                    )}
                  </For>
                </select>
              </label>
            </div>
            <p class="wordmark">MIZUTUNE</p>
            <div class="switches end">
              <Footswitch label="Back" onClick={() => props.onBack()} />
            </div>
            <p class="status" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Screws() {
  return (
    <>
      <span class="screw tl" />
      <span class="screw tr" />
      <span class="screw bl" />
      <span class="screw br" />
    </>
  );
}

function Footswitch(props: { label: string; pressed?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      class="footswitch"
      aria-pressed={props.pressed === undefined ? undefined : props.pressed ? "true" : "false"}
      onClick={() => props.onClick()}
    >
      <span class="well" aria-hidden="true">
        <svg class="nut" viewBox="0 0 80 80">
          <polygon points="40,40 78,40 59,73" fill="#8d8d8d" />
          <polygon points="40,40 59,73 21,73" fill="#555" />
          <polygon points="40,40 21,73 2,40" fill="#555" />
          <polygon points="40,40 2,40 21,7" fill="#8d8d8d" />
          <polygon points="40,40 21,7 59,7" fill="#cfcfcf" />
          <polygon points="40,40 59,7 78,40" fill="#cfcfcf" />
          <polygon
            points="78,40 59,73 21,73 2,40 21,7 59,7"
            fill="none"
            stroke="#333"
            stroke-width="1.5"
          />
          <circle cx="40" cy="40" r="21" fill="#0e4a50" />
        </svg>
        <span class="cap" />
      </span>
      <span class="switch-label">{props.label}</span>
    </button>
  );
}
