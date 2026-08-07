import { redirect } from "next/navigation";

/** Alias legacy `profil.php` → bibliothèque magazines. */
export default function ProfilRedirectPage() {
  redirect("/magazines");
}
