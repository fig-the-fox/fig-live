import type { Metadata } from "next";
import { WhatsNext } from "@/components/WhatsNext";

export const metadata: Metadata = {
  title: "What's next",
  description: "The next recipes for Fig's kit, and how to ask for the order.",
};

export default function NextPage() {
  return <WhatsNext />;
}
