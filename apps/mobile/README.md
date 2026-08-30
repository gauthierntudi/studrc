# STUDRC mobile

App Flutter (Android + iOS) branchée sur **l’API en ligne** `https://api.studrc.com/api`.
Le site [studrc.com](https://studrc.com) est déjà en production : pas besoin de lancer l’API locale pour tester le lecteur public.

```bash
cd apps/mobile
flutter pub get
flutter run
```

`flutter run` sans argument utilise déjà `https://api.studrc.com/api`.

Pour forcer une autre API :

```bash
# Production (défaut)
flutter run --dart-define=API_BASE_URL=https://api.studrc.com/api

# API locale uniquement si vous développez le backend
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001/api   # émulateur Android
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3001/api  # iOS / desktop
```

**Faits prod (août 2026)**

- Santé : `GET https://api.studrc.com/api/health`
- Médias : `https://cdn.studrc.com`
- Accueil / rubriques / articles / HLS : disponibles sans compte
- Login / register : Turnstile obligatoire (`CAPTCHA` actif)
- Jetons mobile (`accessToken` / `refreshToken` dans le JSON) : déployer le correctif auth pour que le compte fonctionne
- Config captcha app : `GET /settings/app` (après déploiement)
- Magazines : numéros `FREE` (ex. Éclats Junior) — aperçu pages sans achat

Turnstile de secours si `/settings/app` n’est pas encore en ligne :

`--dart-define=TURNSTILE_SITE_KEY=…` (clé *site* publique, jamais le secret).

L’admin et les abonnements restent sur le site web.

Si le build iOS échoue à cause de Swift Package Manager (`media_kit` / `flutter_secure_storage`) :

```bash
flutter config --no-enable-swift-package-manager
```
