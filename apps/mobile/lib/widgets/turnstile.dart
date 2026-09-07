import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../core/constants.dart';

/// Turnstile invisible : le jeton est obtenu en arrière-plan.
/// Le widget ne s’affiche que si Cloudflare exige une interaction.
class TurnstileField extends StatefulWidget {
  const TurnstileField({
    super.key,
    required this.siteKey,
    required this.onToken,
    this.theme = 'auto',
  });

  final String siteKey;
  final ValueChanged<String?> onToken;
  final String theme;

  @override
  State<TurnstileField> createState() => _TurnstileFieldState();
}

class _TurnstileFieldState extends State<TurnstileField> {
  WebViewController? _controller;
  bool _failed = false;
  bool _challenge = false;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  @override
  void didUpdateWidget(TurnstileField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.siteKey != widget.siteKey ||
        oldWidget.theme != widget.theme) {
      _boot();
    }
  }

  void _boot() {
    final siteKey = widget.siteKey.trim();
    if (siteKey.isEmpty) {
      _controller = null;
      return;
    }

    final theme = widget.theme;
    final html =
        '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #cf { width: 100%; display: flex; justify-content: center; }
</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async></script>
</head>
<body>
<div id="cf"></div>
<script>
function send(payload) {
  FlutterTurnstile.postMessage(JSON.stringify(payload));
}
function boot() {
  if (!window.turnstile) { setTimeout(boot, 40); return; }
  try {
    turnstile.render('#cf', {
      sitekey: ${jsonEncode(siteKey)},
      theme: ${jsonEncode(theme)},
      size: 'flexible',
      retry: 'auto',
      appearance: 'interaction-only',
      callback: function (t) { send({ t: 'ok', v: t }); },
      'expired-callback': function () { send({ t: 'expired' }); },
      'timeout-callback': function () { send({ t: 'error' }); },
      'error-callback': function () { send({ t: 'error' }); },
      'before-interactive-callback': function () { send({ t: 'show' }); },
      'after-interactive-callback': function () { send({ t: 'hide' }); }
    });
  } catch (e) {
    send({ t: 'error' });
  }
}
boot();
</script>
</body>
</html>
''';

    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onWebResourceError: (err) {
            if (!mounted) return;
            if (err.isForMainFrame != true) return;
            widget.onToken(null);
            setState(() => _failed = true);
          },
        ),
      )
      ..addJavaScriptChannel('FlutterTurnstile', onMessageReceived: _onMessage)
      ..loadHtmlString(html, baseUrl: '$kSiteUrl/');

    _controller = controller;
    _failed = false;
    _challenge = false;
  }

  void _onMessage(JavaScriptMessage msg) {
    if (!mounted) return;
    try {
      final data = jsonDecode(msg.message);
      if (data is! Map) return;
      switch (data['t']) {
        case 'ok':
          final token = '${data['v'] ?? ''}';
          if (token.isNotEmpty) {
            setState(() {
              _failed = false;
              _challenge = false;
            });
            widget.onToken(token);
          }
        case 'expired':
          widget.onToken(null);
        case 'show':
          setState(() => _challenge = true);
        case 'hide':
          setState(() => _challenge = false);
        case 'error':
          widget.onToken(null);
          setState(() => _failed = true);
      }
    } catch (_) {
      final raw = msg.message.trim();
      if (raw.isNotEmpty) widget.onToken(raw);
    }
  }

  void _retry() {
    widget.onToken(null);
    setState(_boot);
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null) return const SizedBox.shrink();

    if (_failed) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Vérification indisponible. Réessayez.',
            style: TextStyle(
              fontSize: 13,
              color: Theme.of(context).colorScheme.error,
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: _retry,
              child: const Text('Réessayer'),
            ),
          ),
        ],
      );
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      height: _challenge ? 78 : 1,
      width: double.infinity,
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(),
      child: Opacity(
        opacity: _challenge ? 1 : 0,
        child: IgnorePointer(
          ignoring: !_challenge,
          child: WebViewWidget(controller: controller),
        ),
      ),
    );
  }
}
