import { For } from "solid-js";
import "./pedal.css";

const MARKS = [-50, -20, 0, 20, 50] as const;

export function Pedal(props: {
  power: boolean;
  note: string;
  octave: number;
  cents: number;
  debug: string;
  status: string;
  onPower: () => void;
  onSetup: () => void;
}) {
  const pegged = () => Math.max(-50, Math.min(50, props.cents));
  const centsText = () => {
    const n = Math.round(props.cents);
    return `${n > 0 ? "+" : ""}${n}¢`;
  };

  return (
    <div class="stage">
      <div class={["pedal", { on: props.power }]}>
        <span class="screw tl" />
        <span class="screw tr" />
        <span class="screw bl" />
        <span class="screw br" />

        <div class={["lcd", { on: props.power }]} style={`--cents: ${pegged()}`}>
          <div class="readout" aria-live="polite">
            <span class="note">{props.note}</span>
            <span class="octave">{props.octave}</span>
          </div>
          <div class="meter">
            <div class="scale">
              <For each={MARKS}>
                {(c) => (
                  <span class="mark" style={`left: calc(50% + ${c} * var(--px))`}>
                    {c === 0 ? "0" : c > 0 ? `+${c}` : String(c)}
                  </span>
                )}
              </For>
            </div>
            <div class="needle" />
          </div>
          <div class="cents">{centsText()}</div>
          <p class="debug">{props.debug}</p>
        </div>

        <p class="wordmark">MIZUTUNE</p>

        <div class="switches">
          <div class="switch-col">
            <span class={["led", { on: props.power }]} />
            <button
              type="button"
              class="footswitch"
              aria-pressed={props.power ? "true" : "false"}
              onClick={() => props.onPower()}
            >
              Power
            </button>
          </div>
          <div class="switch-col">
            <span class="led spacer" />
            <button type="button" class="footswitch" onClick={() => props.onSetup()}>
              Setup
            </button>
          </div>
        </div>

        <p class="status">{props.status}</p>
      </div>
    </div>
  );
}
