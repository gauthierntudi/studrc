import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/constants.dart';
import '../core/models.dart';
import 'turnstile.dart';

class CaptchaBlock extends ConsumerWidget {
  const CaptchaBlock({super.key, required this.onToken, this.reloadToken = 0});

  final ValueChanged<String?> onToken;
  final int reloadToken;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(appSettingsProvider);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final theme = dark ? 'dark' : 'light';

    return async.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) {
        if (kTurnstileSiteKey.isEmpty) return const SizedBox.shrink();
        return TurnstileField(
          key: ValueKey('ts-fallback-$reloadToken'),
          siteKey: kTurnstileSiteKey,
          theme: theme,
          onToken: onToken,
        );
      },
      data: (settings) {
        final key = settings.turnstileSiteKey.isNotEmpty
            ? settings.turnstileSiteKey
            : kTurnstileSiteKey;
        if (!settings.captcha || key.isEmpty) {
          return const SizedBox.shrink();
        }
        return TurnstileField(
          key: ValueKey('ts-$key-$reloadToken'),
          siteKey: key,
          theme: theme,
          onToken: onToken,
        );
      },
    );
  }
}

bool captchaIsRequired(AppSettings? settings) {
  if (settings == null) return kTurnstileSiteKey.isNotEmpty;
  final key = settings.turnstileSiteKey.isNotEmpty
      ? settings.turnstileSiteKey
      : kTurnstileSiteKey;
  return settings.captcha && key.isNotEmpty;
}

Future<String?> waitForCaptchaToken(
  String? Function() read, {
  Duration timeout = const Duration(seconds: 8),
}) async {
  final end = DateTime.now().add(timeout);
  var token = read();
  while ((token == null || token.isEmpty) && DateTime.now().isBefore(end)) {
    await Future.delayed(const Duration(milliseconds: 200));
    token = read();
  }
  if (token == null || token.isEmpty) return null;
  return token;
}
