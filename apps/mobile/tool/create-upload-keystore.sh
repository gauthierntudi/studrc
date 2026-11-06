#!/usr/bin/env bash
# Génère le keystore d’upload Play Store (une seule fois) + key.properties.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID="$ROOT/android"
KEYSTORE="$ANDROID/upload-keystore.jks"
PROPS="$ANDROID/key.properties"
ALIAS="upload"

if [[ -z "${JAVA_HOME:-}" ]]; then
  JAVA_HOME="$(/usr/libexec/java_home 2>/dev/null || true)"
fi
if [[ -z "${JAVA_HOME:-}" && -d "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" ]]; then
  JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"
fi
if [[ -z "${JAVA_HOME:-}" ]]; then
  echo "JAVA_HOME introuvable. Installez un JDK 17+." >&2
  exit 1
fi
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

if [[ -f "$KEYSTORE" && -f "$PROPS" ]]; then
  echo "Keystore déjà présent : $KEYSTORE"
  echo "Empreintes (à coller dans Google Cloud → client OAuth Android) :"
  keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" \
    -storepass "$(sed -n 's/^storePassword=//p' "$PROPS")" 2>/dev/null \
    | grep -Ei 'SHA-?1:|SHA-?256:'
  exit 0
fi

if [[ -f "$KEYSTORE" || -f "$PROPS" ]]; then
  echo "Fichier partiel détecté. Vérifiez $KEYSTORE et $PROPS avant de relancer." >&2
  exit 1
fi

PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"

keytool -genkeypair -v \
  -keystore "$KEYSTORE" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias "$ALIAS" \
  -storepass "$PASS" \
  -keypass "$PASS" \
  -noprompt \
  -dname "CN=STUDRC, OU=Mobile, O=STUDRC, L=Kinshasa, ST=Kinshasa, C=CD"

cat > "$PROPS" <<EOF
storePassword=$PASS
keyPassword=$PASS
keyAlias=$ALIAS
storeFile=../upload-keystore.jks
EOF

chmod 600 "$PROPS" "$KEYSTORE"

echo
echo "Keystore créé (hors git)."
echo "Sauvegardez android/upload-keystore.jks ET android/key.properties hors de cette machine."
echo
echo "Empreintes :"
keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$PASS" \
  | grep -Ei 'SHA-?1:|SHA-?256:'
