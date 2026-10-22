import type { Metadata } from "next";
import { Receipts } from "@/components/Receipts";

export const metadata: Metadata = {
  title: "Receipts",
  description: "Every version of Fig's kit with its SHA-256 fingerprint, and how each one is reviewed.",
};

export default function ReceiptsPage() {
  return <Receipts />;
}
