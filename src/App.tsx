import { createSignal } from "solid-js";
import { createAudioSession } from "./audio/session";
import { createTuner } from "./tuning/map";
import { createSettings } from "./tuning/settings";
import { Pedal } from "./ui/Pedal";

export default function App() {
  const audio = createAudioSession();
  const settings = createSettings();
  const tuner = createTuner({ pitch: audio.pitch, settings: settings.state });
  const [face, setFace] = createSignal(false);

  return (
    <Pedal
      power={audio.power()}
      face={face()}
      live={tuner().live}
      inTune={tuner().inTune}
      note={tuner().note}
      octave={tuner().octave}
      cents={tuner().cents}
      flats={tuner().flats}
      midi={tuner().midi}
      status={audio.error() ?? ""}
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
