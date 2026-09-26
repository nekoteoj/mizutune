import { createAudioSession } from "./audio/session";
import { Pedal } from "./ui/Pedal";

const params = new URLSearchParams(location.search);
const mockCents = Number(params.get("cents") ?? "0") || 0;
const mockNote = params.get("note") || "E";
const mockOctave = Number(params.get("oct") ?? "4") || 4;

export default function App() {
  const audio = createAudioSession();
  const debug = () => {
    const p = audio.pitch();
    return `${p.hz.toFixed(2)} Hz / ${p.clarity.toFixed(3)} / ${p.rms.toFixed(4)} rms`;
  };

  return (
    <Pedal
      power={audio.power()}
      note={mockNote}
      octave={mockOctave}
      cents={mockCents}
      debug={debug()}
      status={audio.error() ?? audio.detail() ?? ""}
      onPower={() => {
        if (audio.power()) audio.stop();
        else void audio.start();
      }}
      onSetup={() => {}}
    />
  );
}
