import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/site/legal-doc";
import { BRAND } from "@/lib/brand";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Conditions générales d’utilisation du site et des services STUDRC.",
};

export default function ConditionsUtilisationPage() {
  return (
    <LegalDoc
      title="Conditions d’utilisation"
      updatedAt="25 août 2026"
      current="terms"
    >
      <p>
        Ces conditions régissent l’accès au site{" "}
        <Link href="/">{BRAND.domain}</Link>, au kiosque, aux articles, aux
        magazines numériques et à l’espace compte de{" "}
        <strong>{BRAND.name}</strong>.
      </p>
      <p>
        En créant un compte, en achetant un magazine, en naviguant sur le site
        {SUBSCRIPTIONS_ENABLED ? " ou en vous abonnant" : ""}, vous les
        acceptez. Sinon, n’utilisez pas le service.
      </p>

      <h2 id="objet">1. Objet du service</h2>
      <p>{BRAND.name} propose notamment :</p>
      <ul>
        <li>la lecture d’articles et de contenus éditoriaux&nbsp;;</li>
        <li>
          le kiosque STU MAG : magazines gratuits et magazines payants à
          l’unité&nbsp;;
        </li>
        {SUBSCRIPTIONS_ENABLED ? (
          <li>
            des formules d’abonnement donnant accès à des contenus payants&nbsp;;
          </li>
        ) : null}
        <li>
          un espace compte pour le profil, les achats et les notifications.
        </li>
      </ul>
      <p>
        Les contenus sont fournis à titre d’information. Ils ne constituent pas
        un conseil professionnel (juridique, financier, pédagogique, etc.).
      </p>

      <h2 id="compte">2. Compte utilisateur</h2>
      <ul>
        <li>
          Vous fournissez des informations exactes et les maintenez à jour.
        </li>
        <li>
          Vous êtes responsable de vos identifiants et de l’activité réalisée
          via votre compte.
        </li>
        <li>
          La connexion via Google est optionnelle ; vous restez responsable du
          compte Google associé.
        </li>
        <li>
          Nous pouvons suspendre ou clôturer un compte en cas d’usage abusif,
          de fraude, d’impayé ou de non-respect des présentes conditions.
        </li>
      </ul>

      <h2 id="acces">3. Accès, magazines et achats</h2>
      <ul>
        <li>
          Les magazines gratuits sont lisibles selon les règles affichées sur
          le kiosque, sans achat.
        </li>
        <li>
          Les prix des magazines payants sont indiqués au moment de la
          commande. L’accès est ouvert après paiement validé.
        </li>
        <li>
          Les numéros achetés restent dans{" "}
          <Link href="/mes-achats">Mes achats</Link>, sous réserve du maintien
          du service.
        </li>
        {SUBSCRIPTIONS_ENABLED ? (
          <li>
            Les formules d’abonnement, leurs durées et avantages sont indiqués
            à la commande. L’accès payant dépend d’un statut actif.
          </li>
        ) : null}
        <li>
          Une offre promotionnelle peut être limitée dans le temps et assortie
          de conditions affichées lors de la commande.
        </li>
      </ul>

      <h2 id="paiements">4. Paiements</h2>
      <p>Les paiements peuvent passer par :</p>
      <ul>
        <li>
          <strong>Carte bancaire</strong> — Stripe&nbsp;;
        </li>
        <li>
          <strong>Mobile Money</strong> — FlexPaie / FlexPay.
        </li>
      </ul>
      <p>
        En validant, vous autorisez le débit du montant affiché. Les
        prestataires appliquent leurs propres conditions. En cas d’échec, de
        rétrofacturation ou de suspicion de fraude, nous pouvons retarder ou
        retirer l’accès concerné.
      </p>
      <p>
        Sauf obligation contraire, les achats numériques sont fermes une fois
        l’accès délivré. Pour une demande de remboursement exceptionnelle,
        contactez le support avec votre référence de paiement.
      </p>

      <h2 id="propriete">5. Propriété intellectuelle</h2>
      <p>
        Textes, images, logos, magazines, mise en page et marque {BRAND.name}{" "}
        sont protégés. Toute reproduction, extraction, redistribution ou
        exploitation commerciale non autorisée est interdite.
      </p>
      <p>
        L’achat confère un droit d’accès personnel, non exclusif et non
        transférable, pour un usage privé. Vous ne pouvez pas revendre, partager
        massivement ni contourner les mesures d’accès.
      </p>

      <h2 id="usage">6. Règles d’usage</h2>
      <p>Il est notamment interdit de :</p>
      <ul>
        <li>
          porter atteinte au site (intrusion, scraping abusif, surcharge)&nbsp;;
        </li>
        <li>usurper une identité ou créer des comptes frauduleux&nbsp;;</li>
        <li>
          publier des contenus illicites via les espaces interactifs&nbsp;;
        </li>
        <li>
          contourner l’authentification, le captcha ou les restrictions
          d’accès.
        </li>
      </ul>

      <h2 id="disponibilite">7. Disponibilité</h2>
      <p>
        Nous visons une disponibilité continue, sans garantie d’absence
        d’interruption. Maintenance, incident ou dépendance tierce (paiement,
        e-mail, CDN) peut limiter l’accès.
      </p>

      <h2 id="responsabilite">8. Responsabilité</h2>
      <p>
        Dans les limites permises par la loi, {BRAND.name} n’est pas
        responsable des dommages indirects, des pertes de données côté
        utilisateur, ou des préjudices liés à un usage non conforme, à un cas
        de force majeure ou à un prestataire tiers.
      </p>
      <p>
        Les liens externes (réseaux, partenaires) sont fournis pour
        information ; nous n’en contrôlons pas le contenu.
      </p>

      <h2 id="donnees">9. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2 id="newsletter">10. Newsletter</h2>
      <p>
        L’inscription est facultative et repose sur votre consentement. Vous
        pouvez vous désinscrire via le lien des e-mails ou en nous écrivant.
      </p>

      <h2 id="modifications">11. Modification des conditions</h2>
      <p>
        Nous pouvons modifier ces conditions. La version applicable est celle
        publiée ici à la date de votre utilisation. La date de mise à jour
        figure en tête de page.
      </p>

      <h2 id="contact">12. Droit applicable</h2>
      <p>
        Les présentes conditions sont régies par le droit de la République
        démocratique du Congo. Tout litige sera soumis aux juridictions
        compétentes de Kinshasa, sous réserve des dispositions impératives
        applicables.
      </p>
      <ul>
        <li>{BRAND.address}</li>
        <li>
          E-mail :{" "}
          <a href={`mailto:${BRAND.infoEmail}`}>{BRAND.infoEmail}</a>
        </li>
        <li>
          Téléphone :{" "}
          <a href={`tel:${BRAND.phone.replace(/\s/g, "")}`}>{BRAND.phone}</a>
        </li>
      </ul>
    </LegalDoc>
  );
}
