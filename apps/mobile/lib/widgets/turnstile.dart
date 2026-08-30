import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class TurnstileField extends StatefulWidget {
  const TurnstileField({
    super.key,
    required this.siteKey,
    required this.onToken,
  });

  final String siteKey;
  final ValueChanged<String> onToken;

  @override
  State<TurnstileField> createState() => _TurnstileFieldState();
}

class _TurnstileFieldState extends State<TurnstileField> {
  WebViewController? _controller;

  @override
  void initState() {
    super.initState();
    _boot(widget.siteKey);
  }

  @override
  void didUpdateWidget(TurnstileField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.siteKey != widget.siteKey) {
      _boot(widget.siteKey);
    }
  }

  void _boot(String siteKey) {
    if (siteKey.isEmpty) {
      _controller = null;
      return;
    }
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'Turnstile',
        onMessageReceived: (msg) => widget.onToken(msg.message),
      )
      ..loadHtmlString('''
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head><body style="margin:0;display:flex;justify-content:center;background:transparent;">
<div class="cf-turnstile" data-sitekey="$siteKey" data-callback="onOk"></div>
<script>function onOk(t){Turnstile.postMessage(t);}</script>
</body></html>
''');
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null) return const SizedBox.shrink();
    return SizedBox(
      height: 70,
      child: WebViewWidget(controller: controller),
    );
  }
}
