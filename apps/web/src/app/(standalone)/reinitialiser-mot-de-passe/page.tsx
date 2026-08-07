import { redirect } from "next/navigation";

/** Ancien flux par lien — redirigé vers OTP. */
export default function LegacyResetPasswordPage() {
  redirect("/mot-de-passe-oublie");
}
