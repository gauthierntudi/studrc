import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api.dart';
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
  String? _message;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });
    try {
      await ref.read(apiClientProvider).forgotPassword(
            _email.text.trim(),
            turnstileToken: _turnstile,
          );
      setState(() {
        _message = 'Si un compte existe, un e-mail de réinitialisation a été envoyé.';
      });
    } catch (e) {
      setState(() => _error = ref.read(apiClientProvider).apiError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mot de passe oublié')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          CaptchaBlock(onToken: (t) => _turnstile = t),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(_message!),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: const Text('Envoyer le lien'),
          ),
        ],
      ),
    );
  }
}
