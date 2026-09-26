import { render } from "@solidjs/web";
import App from "./App.tsx";

if (import.meta.env.PROD) {
  globalThis.navigator?.serviceWorker?.register("/sw.js")?.catch(() => {});
}

render(() => <App />, document.getElementById("root")!);
