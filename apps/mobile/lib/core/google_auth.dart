import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'constants.dart';
import 'models.dart';

class GoogleSignInCanceled implements Exception {
  const GoogleSignInCanceled();
}

class GoogleAuth {
  GoogleAuth._();

  static Future<void>? _ready;
  static String? _serverClientId;
  static String? _iosClientId;

  static String serverClientIdOf(AppSettings? settings) {
    final fromApi = settings?.googleClientId.trim() ?? '';
    if (fromApi.isNotEmpty) return fromApi;
    return kGoogleServerClientId.trim();
  }

  static String iosClientIdOf(AppSettings? settings) {
    final fromApi = settings?.googleIosClientId.trim() ?? '';
    if (fromApi.isNotEmpty) return fromApi;
    return kGoogleIosClientId.trim();
  }

  static bool isConfigured(AppSettings? settings) =>
      serverClientIdOf(settings).isNotEmpty;

  static Future<void> ensureInitialized(AppSettings? settings) {
    final server = serverClientIdOf(settings);
    if (server.isEmpty) {
      return Future.error(StateError('Connexion Google non configurée'));
    }
    final ios = iosClientIdOf(settings);
    if (_ready != null &&
        _serverClientId == server &&
        _iosClientId == ios) {
      return _ready!;
    }
    _serverClientId = server;
    _iosClientId = ios;
    _ready = () async {
      try {
        await GoogleSignIn.instance.initialize(
          clientId:
              defaultTargetPlatform == TargetPlatform.iOS && ios.isNotEmpty
              ? ios
              : null,
          serverClientId: server,
        );
      } catch (error) {
        _ready = null;
        _serverClientId = null;
        _iosClientId = null;
        rethrow;
      }
    }();
    return _ready!;
  }

  /// Retourne l’id_token Google à envoyer à `POST /auth/google`.
  static Future<String> idToken(AppSettings? settings) async {
    await ensureInitialized(settings);
    try {
      try {
        await GoogleSignIn.instance.signOut();
      } catch (_) {}
      final account = await GoogleSignIn.instance.authenticate(
        scopeHint: const ['email', 'profile', 'openid'],
      );
      final token = account.authentication.idToken?.trim() ?? '';
      if (token.isEmpty) {
        throw Exception('Jeton Google indisponible');
      }
      return token;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) {
        throw const GoogleSignInCanceled();
      }
      throw Exception(_messageFor(e));
    }
  }

  static String _messageFor(GoogleSignInException e) {
    switch (e.code) {
      case GoogleSignInExceptionCode.canceled:
        return 'Connexion Google annulée.';
      case GoogleSignInExceptionCode.interrupted:
        return 'Connexion Google interrompue.';
      case GoogleSignInExceptionCode.clientConfigurationError:
        return 'Connexion Google non configurée sur cet appareil.';
      case GoogleSignInExceptionCode.providerConfigurationError:
        return 'Connexion Google indisponible.';
      case GoogleSignInExceptionCode.uiUnavailable:
        return 'Impossible d’afficher la connexion Google.';
      case GoogleSignInExceptionCode.userMismatch:
        return 'Compte Google différent. Réessayez.';
      case GoogleSignInExceptionCode.unknownError:
        return e.description?.trim().isNotEmpty == true
            ? e.description!.trim()
            : 'Connexion Google impossible';
    }
  }
}
