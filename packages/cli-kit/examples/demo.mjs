// node examples/demo.mjs [slug|words]: an intro, a progress bar and a spinner.
import { intro, progress, spinner } from "../src/index.js";

console.log("before the intro");
await intro(process.argv[2] || "AMA CLI", { tagline: "v0.1.0 · cli-kit demo" });
const bar = progress({ label: "Uploading" });
for (let i = 1; i <= 20; i++) { bar.update(i / 20); await new Promise((r) => setTimeout(r, 60)); }
bar.done("Uploaded 20 files");
const s = spinner("Installing");
await new Promise((r) => setTimeout(r, 700));
s.text("Linking");
await new Promise((r) => setTimeout(r, 500));
s.succeed("Installed");
console.log("after, in the scrollback");
