import { createAudioSession } from "./audio/session";

export default function App() {
  const audio = createAudioSession();
  const readout = () => {
    const p = audio.pitch();
    return `${p.hz.toFixed(2)} Hz / ${p.clarity.toFixed(3)} clarity / ${p.rms.toFixed(4)} rms`;
  };
  return (
    <main>
      <button
        type="button"
        aria-pressed={audio.power() ? "true" : "false"}
        onClick={() => {
          if (audio.power()) audio.stop();
          else void audio.start();
        }}
      >
        {audio.power() ? "Power off" : "Power"}
      </button>
      <p>{readout()}</p>
      <p>{audio.error() ?? audio.detail() ?? ""}</p>
    </main>
  );
}
