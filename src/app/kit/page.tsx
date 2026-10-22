import type { Metadata } from "next";
import { KitGuide } from "@/components/KitGuide";

export const metadata: Metadata = {
  title: "Use the kit",
  description: "Rented a GPU? Fig's free kit, in four steps: install, see what you got, pick a recipe, save before your time's up.",
};

export default function KitPage() {
  return <KitGuide />;
}
