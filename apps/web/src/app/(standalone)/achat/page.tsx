import type { Metadata } from "next";
import AchatClient from "./achat-client";

export const metadata: Metadata = {
  title: "Acheter un numéro — Opt1mum",
  description: "Achetez un numéro du magazine Opt1mum en accès immédiat.",
};

export default function AchatPage() {
  return <AchatClient />;
}
