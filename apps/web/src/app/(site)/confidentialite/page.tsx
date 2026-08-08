import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/site/legal-doc";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment Opt1mum collecte, utilise et protège vos données personnelles.",
};

export default function ConfidentialitePage() {
  return (
    <LegalDoc title="Politique de confidentialité" updatedAt="8 août 2026">
      <p>
        La présente politique décrit la manière dont{" "}
        <strong>Opt1mum Corporate</strong> («&nbsp;Opt1mum&nbsp;», «&nbsp;nous&nbsp;»)
        traite les données personnelles dans le cadre du site{" "}
        <Link href="/">opt1mum.com</Link>, de l’application web associée, des
        abonnements et de l’achat de magazines numériques.
      </p>
      <p>
        Elle a un caractère informatif et générique. Pour toute question
        précise, contactez-nous aux coordonnées indiquées ci-dessous.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est Opt1mum Corporate, éditeur du magazine
        Opt1mum.
      </p>
      <ul>
        <li>
          Site : <Link href="/">https://opt1mum.com</Link>
        </li>
        <li>
          E-mail :{" "}
          <a href="mailto:info@opt1mum.com">info@opt1mum.com</a>
        </li>
        <li>
          Téléphone :{" "}
          <a href="tel:+243843966000">+243 843 966 000</a>
        </li>
      </ul>

      <h2>2. Données que nous collectons</h2>
      <p>Selon votre usage du service, nous pouvons traiter :</p>
      <ul>
        <li>
          <strong>Compte abonné</strong> : nom, adresse e-mail, mot de passe
          (stocké sous forme hachée), téléphone, pays, adresse, photo de profil,
          code abonné.
        </li>
        <li>
          <strong>Connexion Google</strong> : identifiant Google, e-mail, nom et
          photo de profil fournis par Google lorsque vous choisissez cette
          option.
        </li>
        <li>
          <strong>Paiements</strong> : références de transaction, montants,
          devise, statut, canal (carte via Stripe ou Mobile Money via FlexPaie).
          Les données de carte bancaire sont traitées par Stripe ; nous ne
          stockons pas le numéro complet de votre carte.
        </li>
        <li>
          <strong>Abonnements et achats</strong> : formules souscrites, magazines
          achetés, historique de paiements et d’accès aux contenus.
        </li>
        <li>
          <strong>Newsletter</strong> : adresse e-mail et consentement associés
          à l’inscription.
        </li>
        <li>
          <strong>Usage du site</strong> : pages consultées, articles lus
          (compteurs de vues), journaux techniques (adresse IP, date/heure) liés
          à la sécurité et au support.
        </li>
        <li>
          <strong>Cookies / session</strong> : cookies HTTP-only nécessaires à
          l’authentification (jetons d’accès et de rafraîchissement).
        </li>
        <li>
          <strong>Messages</strong> : contenus transmis via le formulaire de
          contact ou les échanges support.
        </li>
      </ul>

      <h2>3. Finalités</h2>
      <ul>
        <li>Créer et gérer votre compte abonné.</li>
        <li>
          Fournir l’accès au kiosque, aux magazines numériques et aux articles.
        </li>
        <li>
          Traiter les abonnements, achats unitaires et confirmations de
          paiement.
        </li>
        <li>Envoyer des e-mails transactionnels (compte, paiement, accès).</li>
        <li>
          Envoyer la newsletter lorsque vous y avez consenti.
        </li>
        <li>
          Assurer la sécurité du service, prévenir la fraude et résoudre les
          incidents.
        </li>
        <li>Améliorer le contenu éditorial et l’expérience de lecture.</li>
        <li>Répondre à vos demandes et obligations légales.</li>
      </ul>

      <h2>4. Bases du traitement</h2>
      <p>Selon le cas, le traitement repose sur :</p>
      <ul>
        <li>
          l’exécution du contrat (compte, abonnement, achat, accès aux
          contenus)&nbsp;;
        </li>
        <li>votre consentement (newsletter, certains cookies non essentiels)&nbsp;;</li>
        <li>
          notre intérêt légitime (sécurité, statistiques d’audience agrégées,
          amélioration du service)&nbsp;;
        </li>
        <li>le respect d’obligations légales applicables.</li>
      </ul>

      <h2>5. Destinataires et sous-traitants</h2>
      <p>
        Les données sont accessibles aux équipes habilitées d’Opt1mum. Elles
        peuvent être traitées pour notre compte par des prestataires
        techniques, notamment&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> — paiements par carte ;
        </li>
        <li>
          <strong>FlexPaie / FlexPay</strong> — paiements Mobile Money ;
        </li>
        <li>
          <strong>Resend</strong> — envoi d’e-mails ;
        </li>
        <li>
          <strong>Cloudflare</strong> (stockage R2 / CDN) — médias et fichiers ;
        </li>
        <li>
          <strong>Google</strong> — authentification si vous utilisez «&nbsp;Continuer
          avec Google&nbsp;» ;
        </li>
        <li>
          hébergeur de l’infrastructure (serveur et base de données).
        </li>
      </ul>
      <p>
        Ces prestataires n’agissent que dans le cadre nécessaire à leurs
        services et selon leurs propres politiques de confidentialité.
      </p>

      <h2>6. Transferts et hébergement</h2>
      <p>
        Les données sont hébergées sur des infrastructures situées principalement
        en Europe / auprès de prestataires internationaux (paiements, e-mail,
        stockage). Lorsque des transferts hors de votre pays de résidence
        interviennent, nous nous appuyons sur les garanties prévues par ces
        prestataires et sur les mesures de sécurité appropriées.
      </p>

      <h2>7. Durées de conservation</h2>
      <ul>
        <li>
          Compte abonné : pendant la durée d’utilisation du compte, puis
          archivage ou suppression selon nos besoins opérationnels et obligations
          légales.
        </li>
        <li>
          Données de paiement et facturation : conservation pour la durée
          nécessaire à la comptabilité, à la lutte contre la fraude et aux
          obligations légales.
        </li>
        <li>
          Newsletter : jusqu’à désinscription ou suppression de votre
          consentement.
        </li>
        <li>
          Journaux techniques : durée limitée, nécessaire à la sécurité et au
          diagnostic.
        </li>
      </ul>

      <h2>8. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures raisonnables pour protéger vos
        données : chiffrement HTTPS, mots de passe hachés, cookies de session
        sécurisés, accès restreints à l’administration, et séparation des
        environnements. Aucun système n’étant infaillible, nous vous invitons à
        utiliser un mot de passe unique et robuste.
      </p>

      <h2>9. Vos droits</h2>
      <p>Selon la législation applicable, vous pouvez demander :</p>
      <ul>
        <li>l’accès à vos données ;</li>
        <li>leur rectification ;</li>
        <li>leur effacement, dans les limites prévues ;</li>
        <li>la limitation ou l’opposition à certains traitements ;</li>
        <li>
          la portabilité des données que vous nous avez fournies, lorsque cela
          s’applique ;
        </li>
        <li>
          le retrait de votre consentement (ex. newsletter) à tout moment.
        </li>
      </ul>
      <p>
        Vous pouvez mettre à jour une partie de vos informations depuis votre{" "}
        <Link href="/compte">espace compte</Link>. Pour toute autre demande :
        <a href="mailto:info@opt1mum.com"> info@opt1mum.com</a>.
      </p>

      <h2>10. Cookies</h2>
      <p>
        Le site utilise des cookies strictement nécessaires à la connexion et au
        maintien de votre session. Des outils tiers (ex. Google Sign-In, Stripe)
        peuvent déposer leurs propres cookies selon leur configuration. Vous
        pouvez configurer votre navigateur pour refuser certains cookies ; cela
        peut limiter l’accès aux espaces authentifiés.
      </p>

      <h2>11. Mineurs</h2>
      <p>
        Le service s’adresse principalement à un public adulte. Si vous estimez
        qu’un mineur nous a transmis des données sans autorisation, contactez-nous
        afin que nous puissions les supprimer lorsque cela est possible.
      </p>

      <h2>12. Modifications</h2>
      <p>
        Nous pouvons mettre à jour cette politique pour refléter l’évolution du
        service ou de la réglementation. La date de mise à jour figure en tête
        de page. En cas de changement substantiel, une information pourra être
        publiée sur le site.
      </p>

      <p className="opt-legal__note">
        Document générique d’information. Il ne constitue pas un conseil
        juridique. Pour un audit juridique formalisé (RDC / international),
        faites valider ce texte par un conseil.
      </p>
    </LegalDoc>
  );
}
