import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/constants.dart';
import 'turnstile.dart';

class CaptchaBlock extends ConsumerWidget {
  const CaptchaBlock({super.key, required this.onToken});

  final ValueChanged<String> onToken;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(appSettingsProvider);
    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: LinearProgressIndicator(),
      ),
      error: (_, _) {
        if (kTurnstileSiteKey.isEmpty) {
          return const SizedBox.shrink();
        }
        return TurnstileField(siteKey: kTurnstileSiteKey, onToken: onToken);
      },
      data: (settings) {
        final key = settings.turnstileSiteKey.isNotEmpty
            ? settings.turnstileSiteKey
            : kTurnstileSiteKey;
        if (!settings.captcha && key.isEmpty) {
          return const SizedBox.shrink();
        }
        if (key.isEmpty) {
          return const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
              'Vérification anti-bot requise sur l’API en ligne. '
              'Passez --dart-define=TURNSTILE_SITE_KEY=… ou déployez /settings/app.',
              style: TextStyle(fontSize: 13),
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.only(top: 16),
          child: TurnstileField(siteKey: key, onToken: onToken),
        );
      },
    );
  }
}
