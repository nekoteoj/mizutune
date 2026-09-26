import { createAudioSession } from "./audio/session";
import { Pedal } from "./ui/Pedal";

const params = new URLSearchParams(location.search);
const mockCents = Number(params.get("cents") ?? "0") || 0;
const mockNote = params.get("note") || "E";
const mockOctave = Number(params.get("oct") ?? "4") || 4;

export default function App() {
  const audio = createAudioSession();

  return (
    <Pedal
      power={audio.power()}
      note={mockNote}
      octave={mockOctave}
      cents={mockCents}
      hz={audio.pitch().hz}
      status={audio.error() ?? audio.detail() ?? ""}
      onPower={() => {
        if (audio.power()) audio.stop();
        else void audio.start();
      }}
      onSetup={() => {}}
    />
  );
}
