# STUDRC — règles release. Les plugins Flutter fournissent déjà
# leurs consumer-proguard ; on garde le minimum pour Stripe / media_kit.
-keep class com.stripe.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.stripe.**
# uCrop (image_cropper) référence OkHttp pour les URI distantes ; on recadre
# uniquement des photos locales (galerie / caméra).
-dontwarn okhttp3.**
