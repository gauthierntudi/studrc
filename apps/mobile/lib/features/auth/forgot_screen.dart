import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api.dart';
import '../../widgets/auth_shell.dart';
import '../../widgets/captcha_block.dart';

class ForgotScreen extends ConsumerStatefulWidget {
  const ForgotScreen({super.key});

  @override
  ConsumerState<ForgotScreen> createState() => _ForgotScreenState();
}

class _ForgotScreenState extends ConsumerState<ForgotScreen> {
  final _email = TextEditingController();
  String? _turnstile;
  bool _busy = false;
  int _captchaTick = 0;
  String? _message;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Adresse e-mail invalide.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });
    try {
      final settings = ref.read(appSettingsProvider).valueOrNull;
      var token = _turnstile;
      if (captchaIsRequired(settings)) {
        token = await waitForCaptchaToken(() => _turnstile);
        if (!mounted) return;
        if (token == null) {
          setState(() {
            _busy = false;
            _error = 'Vérification indisponible. Réessayez.';
          });
          return;
        }
      }
      await ref
          .read(apiClientProvider)
          .forgotPassword(email, turnstileToken: token);
      setState(() {
        _message =
            'Si un compte existe, un e-mail de réinitialisation a été envoyé.';
      });
    } catch (e) {
      setState(() {
        _error = ref.read(apiClientProvider).apiError(e);
        _turnstile = null;
        _captchaTick++;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      greeting: 'Oublié ?',
      subtitle:
          'Indiquez l’e-mail de votre compte. Nous vous enverrons un lien.',
      cardTitle: 'Réinitialiser',
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AuthGlassField(
              controller: _email,
              hint: 'Entrez votre e-mail',
              icon: Icons.mail_outline_rounded,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              autofillHints: const [AutofillHints.email],
            ),
            CaptchaBlock(
              reloadToken: _captchaTick,
              onToken: (t) => setState(() => _turnstile = t),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              AuthErrorBanner(_error!),
            ],
            if (_message != null) ...[
              const SizedBox(height: 16),
              AuthNotice(_message!),
            ],
            const SizedBox(height: 20),
            AuthPrimaryButton(
              label: 'Envoyer le lien',
              busy: _busy,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
