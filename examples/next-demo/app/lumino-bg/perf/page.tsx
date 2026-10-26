import { Perf } from "./Perf";

export const metadata = { title: "Lumino backgrounds: frame times" };

/** Renders each background full screen for a few seconds and reports its frame times. ?ids=a,b narrows it, ?seconds=5 sets the time. */
export default function LuminoBackgroundsPerf() {
  return <Perf />;
}
