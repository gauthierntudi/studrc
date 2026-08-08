import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/site/legal-doc";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Conditions générales d’utilisation du site et des services Opt1mum.",
};

export default function ConditionsUtilisationPage() {
  return (
    <LegalDoc title="Conditions d'utilisation" updatedAt="8 août 2026">
      <p>
        Les présentes conditions régissent l’accès et l’utilisation du site{" "}
        <Link href="/">opt1mum.com</Link>, du kiosque numérique, des articles,
        des magazines et des services d’abonnement proposés par{" "}
        <strong>Opt1mum Corporate</strong> («&nbsp;Opt1mum&nbsp;», «&nbsp;nous&nbsp;»).
      </p>
      <p>
        En créant un compte, en vous abonnant, en effectuant un achat ou en
        naviguant sur le site, vous acceptez ces conditions. Si vous n’y
        consentez pas, veuillez ne pas utiliser le service.
      </p>

      <h2>1. Objet du service</h2>
      <p>Opt1mum propose notamment :</p>
      <ul>
        <li>la consultation d’articles et de contenus éditoriaux ;</li>
        <li>l’achat unitaire de magazines numériques ;</li>
        <li>des formules d’abonnement donnant accès à des contenus payants ;</li>
        <li>
          un espace compte permettant de gérer le profil, les achats et
          l’abonnement.
        </li>
      </ul>
      <p>
        Le contenu éditorial est fourni à titre d’information. Il ne constitue
        pas un conseil professionnel (juridique, financier, médical, etc.).
      </p>

      <h2>2. Compte utilisateur</h2>
      <ul>
        <li>
          Vous devez fournir des informations exactes et les maintenir à jour.
        </li>
        <li>
          Vous êtes responsable de la confidentialité de vos identifiants et de
          l’activité réalisée via votre compte.
        </li>
        <li>
          La connexion via Google est proposée en option ; vous restez
          responsable de l’usage de votre compte Google associé.
        </li>
        <li>
          Nous pouvons suspendre ou résilier un compte en cas d’usage abusif,
          de fraude, d’impayé ou de non-respect des présentes conditions.
        </li>
      </ul>

      <h2>3. Abonnements et achats</h2>
      <ul>
        <li>
          Les prix, durées et avantages des formules sont indiqués au moment de
          la commande.
        </li>
        <li>
          L’accès aux contenus payants est conditionné au paiement validé et au
          statut actif de l’abonnement ou de l’achat.
        </li>
        <li>
          Les magazines numériques acquis restent accessibles selon les règles
          du compte (espace «&nbsp;Mes achats&nbsp;»), sous réserve du maintien du
          service.
        </li>
        <li>
          Toute promotion ou offre spéciale peut être limitée dans le temps et
          assortie de conditions particulières affichées lors de la commande.
        </li>
      </ul>

      <h2>4. Paiements</h2>
      <p>Les paiements peuvent être effectués via :</p>
      <ul>
        <li>
          <strong>Carte bancaire</strong> — traité par Stripe ;
        </li>
        <li>
          <strong>Mobile Money</strong> — traité par FlexPaie / FlexPay.
        </li>
      </ul>
      <p>
        En validant un paiement, vous autorisez le débit du montant affiché.
        Les prestataires de paiement appliquent leurs propres conditions. En
        cas d’échec, de chargeback ou de suspicion de fraude, nous pouvons
        retarder ou retirer l’accès aux contenus concernés.
      </p>
      <p>
        Sauf disposition contraire obligatoire, les achats numériques sont
        fermes une fois l’accès au contenu délivré. Pour une demande de
        remboursement exceptionnelle, contactez le support avec votre référence
        de paiement.
      </p>

      <h2>5. Propriété intellectuelle</h2>
      <p>
        L’ensemble des contenus du site (textes, images, logos, magazines, mise
        en page, marques «&nbsp;Opt1mum&nbsp;», etc.) est protégé. Toute
        reproduction, extraction, redistribution ou exploitation commerciale
        non autorisée est interdite.
      </p>
      <p>
        L’achat ou l’abonnement confère un droit d’accès personnel,
        non exclusif et non transférable, pour un usage privé. Vous ne pouvez
        pas revendre, partager massivement ni contourner les mesures
        techniques d’accès.
      </p>

      <h2>6. Règles d’usage</h2>
      <p>Il est notamment interdit de :</p>
      <ul>
        <li>
          porter atteinte au fonctionnement du site (intrusion, scraping abusif,
          surcharge) ;
        </li>
        <li>usurper l’identité d’autrui ou créer des comptes frauduleux ;</li>
        <li>
          publier des contenus illicites via les espaces interactifs
          (commentaires, messages) ;
        </li>
        <li>
          contourner l’authentification, le paywall ou les restrictions
          d’accès.
        </li>
      </ul>

      <h2>7. Disponibilité</h2>
      <p>
        Nous nous efforçons d’assurer une disponibilité continue du service,
        sans garantie d’absence d’interruption. Des maintenances, incidents
        techniques ou dépendances tierces (paiement, e-mail, CDN) peuvent
        temporairement limiter l’accès.
      </p>

      <h2>8. Responsabilité</h2>
      <p>
        Dans les limites permises par la loi, Opt1mum ne saurait être tenu
        responsable des dommages indirects, pertes de données côté utilisateur,
        ou préjudices résultant d’un usage non conforme du service, d’un cas de
        force majeure, ou d’une défaillance d’un prestataire tiers.
      </p>
      <p>
        Les liens vers des sites externes (réseaux sociaux, partenaires) sont
        fournis pour information ; nous n’en contrôlons pas le contenu.
      </p>

      <h2>9. Données personnelles</h2>
      <p>
        Le traitement de vos données est décrit dans notre{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>10. Newsletter</h2>
      <p>
        L’inscription à la newsletter est facultative et repose sur votre
        consentement. Vous pouvez vous désinscrire à tout moment via le lien
        prévu dans les e-mails ou en nous contactant.
      </p>

      <h2>11. Modification des conditions</h2>
      <p>
        Nous pouvons modifier les présentes conditions. La version applicable
        est celle publiée sur cette page à la date de votre utilisation du
        service. La date de mise à jour figure en tête de page.
      </p>

      <h2>12. Contact</h2>
      <ul>
        <li>
          E-mail :{" "}
          <a href="mailto:info@opt1mum.com">info@opt1mum.com</a>
        </li>
        <li>
          Téléphone :{" "}
          <a href="tel:+243843966000">+243 843 966 000</a>
        </li>
      </ul>

      <p className="opt-legal__note">
        Document générique. Pour une version juridiquement opposable adaptée à
        votre juridiction et à vos process métier, faites-le valider par un
        conseil.
      </p>
    </LegalDoc>
  );
}
