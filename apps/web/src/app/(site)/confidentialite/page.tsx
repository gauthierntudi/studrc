import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/site/legal-doc";
import { BRAND } from "@/lib/brand";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment STUDRC collecte, utilise et protège vos données personnelles.",
};

export default function ConfidentialitePage() {
  return (
    <LegalDoc
      title="Politique de confidentialité"
      updatedAt="25 août 2026"
      current="privacy"
    >
      <p>
        Cette politique explique comment <strong>{BRAND.name}</strong> traite
        vos données personnelles lorsque vous utilisez le site{" "}
        <Link href="/">{BRAND.domain}</Link>, le kiosque, les articles, les
        magazines numériques et votre espace compte.
      </p>

      <h2 id="responsable">1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est {BRAND.legalName}, média et
        observatoire du système éducatif de la République démocratique du Congo.
      </p>
      <ul>
        <li>Adresse : {BRAND.address}</li>
        <li>
          Site : <Link href="/">{BRAND.siteUrl}</Link>
        </li>
        <li>
          E-mail :{" "}
          <a href={`mailto:${BRAND.infoEmail}`}>{BRAND.infoEmail}</a>
        </li>
        <li>
          Téléphone :{" "}
          <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`}>{BRAND.phone}</a>
        </li>
      </ul>

      <h2 id="donnees">2. Données que nous collectons</h2>
      <p>Selon votre usage du service, nous pouvons traiter :</p>
      <ul>
        <li>
          <strong>Compte</strong> : nom, adresse e-mail, mot de passe (haché),
          téléphone, pays, adresse, photo de profil, code abonné.
        </li>
        <li>
          <strong>Connexion Google</strong> : identifiant Google, e-mail, nom et
          photo fournis par Google si vous choisissez cette option.
        </li>
        <li>
          <strong>Paiements</strong> : références de transaction, montants,
          devise, statut, canal (carte via Stripe ou Mobile Money via FlexPaie).
          Les données de carte sont traitées par Stripe ; nous ne stockons pas
          le numéro complet de votre carte.
        </li>
        <li>
          <strong>Achats{SUBSCRIPTIONS_ENABLED ? " et abonnements" : ""}</strong>{" "}
          : magazines achetés, historique de paiements et d’accès aux
          contenus
          {SUBSCRIPTIONS_ENABLED
            ? ", formules souscrites."
            : "."}
        </li>
        <li>
          <strong>Newsletter</strong> : adresse e-mail et consentement liés à
          l’inscription.
        </li>
        <li>
          <strong>Usage du site</strong> : pages consultées, articles lus
          (compteurs de vues), journaux techniques (adresse IP, date et heure)
          pour la sécurité et le support.
        </li>
        <li>
          <strong>Protection anti-abus</strong> : jeton Cloudflare Turnstile
          lors de l’inscription, de la connexion ou d’un formulaire protégé,
          lorsque le captcha est activé.
        </li>
        <li>
          <strong>Session</strong> : cookies HTTP-only nécessaires à
          l’authentification (jetons d’accès et de rafraîchissement).
        </li>
        <li>
          <strong>Messages</strong> : contenus envoyés via le contact ou le
          support.
        </li>
      </ul>

      <h2 id="finalites">3. Finalités</h2>
      <ul>
        <li>Créer et gérer votre compte.</li>
        <li>
          Donner accès aux articles, au kiosque et aux magazines (gratuits ou
          achetés).
        </li>
        <li>
          Traiter les achats
          {SUBSCRIPTIONS_ENABLED ? ", abonnements" : ""} et confirmations de
          paiement.
        </li>
        <li>Envoyer les e-mails de compte, de paiement et d’accès.</li>
        <li>Envoyer la newsletter si vous y avez consenti.</li>
        <li>
          Sécuriser le service, limiter la fraude et traiter les incidents.
        </li>
        <li>Améliorer le contenu éditorial et la lecture.</li>
        <li>Répondre à vos demandes et aux obligations légales.</li>
      </ul>

      <h2 id="bases">4. Bases du traitement</h2>
      <p>Selon le cas, le traitement repose sur :</p>
      <ul>
        <li>
          l’exécution du contrat (compte, achat, accès aux contenus
          {SUBSCRIPTIONS_ENABLED ? ", abonnement" : ""})&nbsp;;
        </li>
        <li>votre consentement (newsletter, captcha le cas échéant)&nbsp;;</li>
        <li>
          notre intérêt légitime (sécurité, statistiques agrégées, amélioration
          du service)&nbsp;;
        </li>
        <li>le respect d’obligations légales applicables.</li>
      </ul>

      <h2 id="destinataires">5. Destinataires et sous-traitants</h2>
      <p>
        Les données sont accessibles aux équipes habilitées de {BRAND.name}.
        Elles peuvent être traitées pour notre compte par :
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> — paiements par carte&nbsp;;
        </li>
        <li>
          <strong>FlexPaie / FlexPay</strong> — paiements Mobile Money&nbsp;;
        </li>
        <li>
          <strong>Resend</strong> — envoi d’e-mails&nbsp;;
        </li>
        <li>
          <strong>Cloudflare</strong> — stockage R2 / CDN des médias, et
          Turnstile lorsque le captcha est actif&nbsp;;
        </li>
        <li>
          <strong>Google</strong> — authentification si vous utilisez Continuer
          avec Google&nbsp;;
        </li>
        <li>l’hébergeur de l’infrastructure (serveur et base de données).</li>
      </ul>
      <p>
        Ces prestataires n’agissent que dans le cadre nécessaire à leurs
        services, selon leurs propres politiques.
      </p>

      <h2 id="transferts">6. Transferts et hébergement</h2>
      <p>
        Les données sont hébergées principalement en Europe et auprès de
        prestataires internationaux (paiements, e-mail, stockage, captcha).
        Lorsque des transferts hors de votre pays de résidence ont lieu, nous
        nous appuyons sur les garanties de ces prestataires et sur des mesures
        de sécurité adaptées.
      </p>

      <h2 id="durees">7. Durées de conservation</h2>
      <ul>
        <li>
          Compte : pendant l’utilisation, puis archivage ou suppression selon
          les besoins opérationnels et les obligations légales.
        </li>
        <li>
          Paiements : durée nécessaire à la comptabilité, à la lutte contre la
          fraude et aux obligations légales.
        </li>
        <li>
          Newsletter : jusqu’à désinscription ou retrait du consentement.
        </li>
        <li>
          Journaux techniques : durée limitée, pour la sécurité et le
          diagnostic.
        </li>
      </ul>

      <h2 id="securite">8. Sécurité</h2>
      <p>
        Nous appliquons des mesures raisonnables : HTTPS, mots de passe hachés,
        cookies de session sécurisés, accès administration restreint. Aucun
        système n’est infaillible : utilisez un mot de passe unique et robuste.
      </p>

      <h2 id="droits">9. Vos droits</h2>
      <p>Selon la législation applicable, vous pouvez demander :</p>
      <ul>
        <li>l’accès à vos données&nbsp;;</li>
        <li>leur rectification&nbsp;;</li>
        <li>leur effacement, dans les limites prévues&nbsp;;</li>
        <li>la limitation ou l’opposition à certains traitements&nbsp;;</li>
        <li>
          la portabilité des données que vous nous avez fournies, lorsque cela
          s’applique&nbsp;;
        </li>
        <li>
          le retrait de votre consentement (newsletter) à tout moment.
        </li>
      </ul>
      <p>
        Une partie des informations se met à jour depuis votre{" "}
        <Link href="/compte">espace compte</Link>. Pour le reste :{" "}
        <a href={`mailto:${BRAND.infoEmail}`}>{BRAND.infoEmail}</a>.
      </p>

      <h2 id="cookies">10. Cookies</h2>
      <p>
        Le site utilise des cookies strictement nécessaires à la connexion et à
        la session. Cloudflare Turnstile, Google Sign-In et Stripe peuvent
        déposer leurs propres cookies selon leur configuration. Refuser certains
        cookies dans le navigateur peut limiter l’accès aux espaces connectés.
      </p>

      <h2 id="mineurs">11. Mineurs</h2>
      <p>
        Le service s’adresse principalement à un public adulte. Si un mineur
        nous a transmis des données sans autorisation, écrivez-nous pour que
        nous les supprimions lorsque c’est possible.
      </p>

      <h2 id="modifications">12. Modifications</h2>
      <p>
        Nous pouvons mettre à jour cette politique. La date figurant en tête de
        page fait foi. Un changement substantiel pourra être annoncé sur le
        site. Voir aussi les{" "}
        <Link href="/conditions-utilisation">conditions d’utilisation</Link>.
      </p>
    </LegalDoc>
  );
}
