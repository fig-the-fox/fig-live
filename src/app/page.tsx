import { DoingNow } from "@/components/DoingNow";
import { Hero } from "@/components/Hero";
import { LiveProvider } from "@/components/LiveProvider";
import { SayHi } from "@/components/SayHi";
import { StatusStrip } from "@/components/StatusStrip";
import { UptimeStrip } from "@/components/UptimeStrip";
import { IS_WEB4 } from "@/lib/site";

// Home is the only page with live data. The 30 s poll lives in LiveProvider and only runs here.
// The uptime strip is a build-time snapshot (public/uptime.json) built from the watcher log on
// Terminal's machine, labelled as such. The web4 build leaves it out: that log doesn't exist there.
export default function Home() {
  return (
    <LiveProvider>
      <Hero />
      <StatusStrip />
      {IS_WEB4 ? null : <UptimeStrip />}
      <DoingNow />
      <SayHi />
    </LiveProvider>
  );
}
