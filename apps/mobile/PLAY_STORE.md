# Publication Android — Google Play

Package : `com.studrc.studrc` · version `1.0.0+2` · API `https://api.studrc.com/api`

## 1. Keystore d’upload (une fois)

```bash
cd apps/mobile
chmod +x tool/create-upload-keystore.sh
./tool/create-upload-keystore.sh
```

Fichiers **hors git** (à sauvegarder, coffre-fort / 1Password) :

- `android/upload-keystore.jks`
- `android/key.properties`

Sans eux, vous ne pourrez plus mettre l’app à jour.

Ajoutez les empreintes **SHA-1** et **SHA-256** du keystore dans Google Cloud Console → client OAuth **Android** (`com.studrc.studrc`). Après la première upload Play, ajoutez aussi les empreintes **App signing** (Play Console → Intégrité de l’app) : Google resignera l’AAB.

Pour réafficher les empreintes (sans régénérer le keystore) :

```bash
./tool/create-upload-keystore.sh
```

## 2. Build AAB

Google Sign-In et Turnstile peuvent aussi venir de `GET /settings/app`. Les `--dart-define` ci-dessous sont le secours compilé dans l’AAB (clés *publiques* client).

```bash
cd apps/mobile
flutter build appbundle --release \
  --dart-define=GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  --dart-define=TURNSTILE_SITE_KEY="$TURNSTILE_SITE_KEY"
```

Fichier : `build/app/outputs/bundle/release/app-release.aab`

## 3. Play Console — fiche

| Champ | Valeur |
|--------|--------|
| Nom | STUDRC |
| Langue par défaut | Français |
| Application | Gratuite |
| Catégorie | Actualités et magazines |
| E-mail contact | info@studrc.com |
| Site | https://studrc.com |
| Politique de confidentialité | https://studrc.com/confidentialite |
| Conditions | https://studrc.com/conditions-utilisation |
| Pays | au minimum RDC + diaspora (selon licence) |

**Description courte (80 car. max)**

```
Média et observatoire de l’éducation en RDC : actualités, magazines et kiosque.
```

**Description longue**

```
STUDRC est la plateforme média et observatoire du système éducatif de la République Démocratique du Congo.

Dans l’app :
• Accueil et actualités (Stu News, Stu Data, Stu Stories, Stu Talk, Shorts)
• Kiosque de magazines numériques
• Compte : achats, notifications, photo de profil
• Connexion e-mail ou Google

Site : https://studrc.com
```

**Visuels demandés par Play**

- Icône 512×512 PNG (sans transparence)
- Feature graphic 1024×500 : `play/feature-graphic-1024x500.png`
- Au moins 2 captures téléphone (1080×1920 ou 1080×2340), français
- Tablette facultatif

## 4. Questionnaire « Données de sécurité »

L’app n’affiche pas de pub. Déclarez notamment :

| Donnée | Collectée | Finalité |
|--------|-----------|----------|
| Nom, e-mail, téléphone | Oui (compte) | Compte, communication |
| Photos | Oui (avatar, galerie / caméra) | Photo de profil |
| Achats in-app / historique | Oui | Kiosque, magazines |
| Identifiants du compte | Oui | Auth, Google Sign-In |

- Chiffrement en transit : oui (HTTPS)
- Compte supprimable : via le site / support `info@studrc.com` (à confirmer)
- ID publicitaire : **non** (pas de permission `AD_ID` dans le manifeste)

Caméra : photo de profil uniquement, non obligatoire.

## 5. Contenu / public

- Public : tout public (information)
- Pas de pub, pas de ciblage enfants
- Contenu généré par STUDRC (rédaction)

## 6. Checklist avant envoi

- [ ] Keystore sauvegardé
- [ ] SHA-1 upload + SHA-1 Play App Signing dans le client OAuth Android
- [ ] AAB `app-release.aab` signé (pas le debug)
- [ ] Politique de confidentialité accessible sans login
- [ ] Test interne (piste interne Play) sur un vrai téléphone
- [ ] Paiements : Stripe / FlexPaie déjà côté serveur — pas de Billing Play si vous ne vendez pas via Google Play Billing (magazines via votre kiosque)
