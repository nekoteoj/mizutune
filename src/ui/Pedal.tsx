import { For, Show } from "solid-js";
import { spell } from "../tuning/map";
import type { Settings } from "../tuning/settings";
import { tuningsFor } from "../tuning/settings";
import "./pedal.css";

export function Pedal(props: {
  power: boolean;
  face: boolean;
  live: boolean;
  inTune: boolean;
  note: string;
  octave: number;
  cents: number;
  flats: boolean;
  midi: number;
  status: string;
  settings: Settings;
  onPower: () => void;
  onSetup: () => void;
  onBack: () => void;
  onA4: (hz: number) => void;
  onMode: (mode: string) => void;
  onTuning: (id: string) => void;
}) {
  const neighbors = () =>
    [-2, -1, 0, 1, 2].map((d) => {
      const midi = props.midi + d;
      return { midi, at: (d + 2) * 100, label: spell(midi, props.flats).label };
    });
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
            <div class={["window", { on: props.power, tune: props.inTune }]} style={`--cents: ${props.cents}`}>
              <div class="card">
                <div class="meter" aria-hidden="true">
                  <div class="scale">
                    <Show when={props.live}>
                      <For each={neighbors()} keyed={(n) => n.midi}>
                        {(n) => (
                          <span class="mark" style={`left: calc(${n().at} * var(--px))`}>
                            {n().label}
                          </span>
                        )}
                      </For>
                    </Show>
                  </div>
                  <div class="needle" />
                </div>
                <div class="figures" aria-live="polite">
                  <span class="now">{props.live ? `${props.note}${props.octave}` : "—"}</span>
                  <span class="cents">{props.live ? centsText() : ""}</span>
                </div>
              </div>
            </div>
            <p class="wordmark">MIZUTUNE</p>
            <div class="switches">
              <div class="switch-col">
                <span class={["led", { on: props.power, tune: props.inTune }]} />
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
