import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

/// « Se connecter avec Apple » (iOS uniquement) — exigé par l’App Store
/// (règle 4.8) dès qu’une connexion tierce comme Google est proposée.
class AppleSignInButton extends StatelessWidget {
  const AppleSignInButton({
    super.key,
    required this.busy,
    required this.onPressed,
  });

  final bool busy;
  final VoidCallback onPressed;

  static bool get isSupported => !kIsWeb && Platform.isIOS;

  @override
  Widget build(BuildContext context) {
    if (!isSupported) return const SizedBox.shrink();
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: AbsorbPointer(
        absorbing: busy,
        child: SignInWithAppleButton(
          text: 'Continuer avec Apple',
          height: 52,
          borderRadius: const BorderRadius.all(Radius.circular(12)),
          style: dark
              ? SignInWithAppleButtonStyle.white
              : SignInWithAppleButtonStyle.black,
          onPressed: onPressed,
        ),
      ),
    );
  }
}

/// Lance la feuille Apple. Renvoie null si l’utilisateur annule.
Future<({String identityToken, String? name})?> requestAppleCredential() async {
  try {
    final credential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
    );
    final token = credential.identityToken;
    if (token == null || token.isEmpty) {
      throw StateError('Apple n’a pas renvoyé de jeton');
    }
    final name = [credential.givenName, credential.familyName]
        .whereType<String>()
        .where((p) => p.trim().isNotEmpty)
        .join(' ');
    return (identityToken: token, name: name.isEmpty ? null : name);
  } on SignInWithAppleAuthorizationException catch (e) {
    if (e.code == AuthorizationErrorCode.canceled) return null;
    rethrow;
  }
}
