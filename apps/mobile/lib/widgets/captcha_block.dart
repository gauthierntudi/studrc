import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/models.dart';

class CaptchaBlock extends ConsumerWidget {
  const CaptchaBlock({super.key, required this.onToken, this.reloadToken = 0});

  final ValueChanged<String?> onToken;
  final int reloadToken;

  /// Turnstile n’est plus affiché dans l’app : la WebView échouait sur
  /// certains appareils (refus App Store 2.1). L’API exempte les requêtes
  /// de l’app (en-tête X-StuDRC-Client) et reste limitée en débit.
  @override
  Widget build(BuildContext context, WidgetRef ref) => const SizedBox.shrink();
}

bool captchaIsRequired(AppSettings? settings) => false;

Future<String?> waitForCaptchaToken(
  String? Function() read, {
  Duration timeout = const Duration(seconds: 20),
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
