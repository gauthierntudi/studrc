import type { Metadata } from "next";
import AchatClient from "./achat-client";

export const metadata: Metadata = {
  title: "Acheter un numéro — STU MAG",
  description: "Achetez un numéro de STU MAG en accès immédiat.",
};

export default function AchatPage() {
  return <AchatClient />;
}
