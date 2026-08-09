# UI — port fidèle du legacy

Objectif : **reproduire l’UI du projet PHP** (site public + admin), pas une réinterprétation.

## Stratégie

1. Réutiliser les **CSS legacy** (`bootstrap`, `style.css`, `responsive.css`, `auth-modal.css`) et fontes **Kelson** (Oswald).
2. Reproduire le **markup** de `includes/header.php` / `footer.php` / pages (`index`, `kiosque`, `pricing`).
3. Brancher ensuite les données API (covers, articles) dans les mêmes emplacements — placeholders dans `src/lib/legacy-demo.ts`.

## Assets Next

```
apps/web/public/legacy/
  css/   bootstrap, style, responsive, auth-modal, ionicons, all (FA), breakingNews
  fonts/ Oswald + Font Awesome
  img/   logo-hd, banner-header, kiosque1, kios, puces, abonnement, paiement…
  covers/  échantillons
  articles/ échantillons
```

## Site public

| Legacy | React |
|--------|--------|
| Header (refonte presse) | `components/site/site-header.tsx` — 2 rangées style JA, logo centré |
| `includes/footer.php` | `components/site/site-footer.tsx` |
| `index.php` mosaïque + kiosque | `home-banner`, `breaking-news`, `home-kiosque` |
| `kiosque.php` | `app/(standalone)/kiosque` (sans chrome site) |
| `pricing.php` | `app/(standalone)/abonnement` (sans chrome site) |
| `auth-modals.php` | pages `/connexion`, `/inscription` + `AuthPanel` |
| `settings.php` | `app/(site)/compte` |
| `profil.php` | `app/(site)/magazines` — bibliothèque abonné (`/profil` redirige) |

Couleurs exactes : CTA `#02d0d1`, copyright `#e9262a`, bandeau header `banner-header.png`, nav `#f1f1f1`.

## Admin

| Legacy | React |
|--------|--------|
| Topbar dégradé `#021762 → #037d95` | `components/admin/admin-shell.tsx` |
| Sidebar blanche Material Pro | idem |

## Non porté (pour l’instant)

- Mega-menu Owl Decryptage + carousel Owl (slides statiques pour l’instant)
- Menu morphing modal plein écran desktop
- Flipbook Turn.js → PDF.js plus tard

## Typo (refonte)

Sans empattements Google via `next/font` :

| Rôle | Police |
|------|--------|
| UI / corps | **Plus Jakarta Sans** |
| Titres / display | **Archivo** |

Variables : `--opt-font-sans`, `--opt-font-display`. Les alias Kelson legacy sont remappés vers cette stack (ok).
