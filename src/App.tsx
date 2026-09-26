import { createSignal } from "solid-js";
import { createAudioSession } from "./audio/session";
import { createSettings } from "./tuning/settings";
import { Pedal } from "./ui/Pedal";

const params = new URLSearchParams(location.search);
const mockCents = Number(params.get("cents") ?? "0") || 0;
const mockNote = params.get("note") || "E";
const mockOctave = Number(params.get("oct") ?? "4") || 4;

export default function App() {
  const audio = createAudioSession();
  const settings = createSettings();
  const [face, setFace] = createSignal(false);

  return (
    <Pedal
      power={audio.power()}
      face={face()}
      note={mockNote}
      octave={mockOctave}
      cents={mockCents}
      hz={audio.pitch().hz}
      status={audio.error() ?? audio.detail() ?? ""}
      settings={settings.state}
      onPower={() => {
        if (audio.power()) audio.stop();
        else void audio.start();
      }}
      onSetup={() => setFace(true)}
      onBack={() => setFace(false)}
      onA4={(hz) => settings.setA4(hz)}
      onMode={(mode) => settings.setMode(mode)}
      onTuning={(id) => settings.setTuning(id)}
    />
  );
}
