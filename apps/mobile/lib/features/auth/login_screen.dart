import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api.dart';
import '../../core/google_auth.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_shell.dart';
import '../../widgets/captcha_block.dart';
import '../../widgets/google_sign_in_button.dart';

const _kRememberEmail = 'auth.remember_email';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.signup = false});

  final bool signup;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _turnstile;
  bool _signup = false;
  bool _busy = false;
  bool _obscure = true;
  bool _remember = true;
  int _captchaTick = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    _signup = widget.signup;
    _restoreEmail();
  }

  Future<void> _restoreEmail() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kRememberEmail);
    if (saved != null && saved.isNotEmpty && mounted) {
      _email.text = saved;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<String?> _token() async {
    final settings = ref.read(appSettingsProvider).valueOrNull;
    if (!captchaIsRequired(settings)) return _turnstile;
    final token = await waitForCaptchaToken(() => _turnstile);
    if (token == null && mounted) {
      setState(() {
        _busy = false;
        _error = 'Vérification indisponible. Réessayez.';
      });
    }
    return token;
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;

    if (_signup) {
      final name = _name.text.trim();
      if (name.length < 2) {
        setState(() => _error = 'Indiquez votre nom (2 caractères min.).');
        return;
      }
      if (!email.contains('@')) {
        setState(() => _error = 'Adresse e-mail invalide.');
        return;
      }
      if (password.length < 8) {
        setState(() => _error = 'Le mot de passe doit faire 8 caractères min.');
        return;
      }
    } else if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Indiquez votre e-mail et votre mot de passe.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = await _token();
      if (!mounted) return;
      if (captchaIsRequired(ref.read(appSettingsProvider).valueOrNull) &&
          token == null) {
        return;
      }

      if (_signup) {
        await ref
            .read(sessionProvider.notifier)
            .register(
              name: _name.text.trim(),
              email: email,
              password: password,
              turnstile: token,
            );
      } else {
        await ref
            .read(sessionProvider.notifier)
            .login(email, password, turnstile: token);
        final prefs = await SharedPreferences.getInstance();
        if (_remember) {
          await prefs.setString(_kRememberEmail, email);
        } else {
          await prefs.remove(_kRememberEmail);
        }
      }
      if (mounted) context.go('/compte');
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

  Future<void> _submitGoogle() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = await _token();
      if (!mounted) return;
      if (captchaIsRequired(ref.read(appSettingsProvider).valueOrNull) &&
          token == null) {
        return;
      }
      final settings = ref.read(appSettingsProvider).valueOrNull;
      final credential = await GoogleAuth.idToken(settings);
      if (!mounted) return;
      await ref
          .read(sessionProvider.notifier)
          .loginWithGoogle(credential, turnstile: token);
      if (mounted) context.go('/compte');
    } on GoogleSignInCanceled {
      return;
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
      greeting: _signup ? 'Bienvenue !' : 'Bonjour !',
      subtitle: _signup
          ? 'Créez votre compte avec votre e-mail ou Google.'
          : 'Connectez-vous avec votre e-mail ou Google.',
      cardTitle: _signup ? 'Inscription' : 'Connexion',
      footer: Wrap(
        alignment: WrapAlignment.center,
        children: [
          Text(
            _signup ? 'Déjà un compte ? ' : 'Pas encore de compte ? ',
            style: AppTheme.sansText(
              size: 14,
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.55),
            ),
          ),
          GestureDetector(
            onTap: () => setState(() {
              _signup = !_signup;
              _error = null;
            }),
            child: Text(
              _signup ? 'Se connecter' : 'Créer un compte',
              style: AppTheme.sansText(
                size: 14,
                weight: FontWeight.w800,
                color: AppTheme.blue,
              ),
            ),
          ),
        ],
      ),
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_signup) ...[
              AuthGlassField(
                controller: _name,
                hint: 'Entrez votre nom',
                icon: LucideIcons.userRound,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.name],
              ),
              const SizedBox(height: 14),
            ],
            AuthGlassField(
              controller: _email,
              hint: 'Entrez votre e-mail',
              icon: LucideIcons.mail,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
            ),
            const SizedBox(height: 14),
            AuthGlassField(
              controller: _password,
              hint: _signup
                  ? 'Mot de passe (8 car. min.)'
                  : 'Entrez votre mot de passe',
              icon: LucideIcons.lock,
              obscure: _obscure,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              autofillHints: [
                if (_signup)
                  AutofillHints.newPassword
                else
                  AutofillHints.password,
              ],
              suffix: IconButton(
                tooltip: _obscure ? 'Afficher' : 'Masquer',
                onPressed: () => setState(() => _obscure = !_obscure),
                icon: Icon(
                  _obscure
                      ? LucideIcons.eye
                      : LucideIcons.eyeOff,
                  color: Theme.of(
                    context,
                  ).colorScheme.onSurface.withValues(alpha: 0.45),
                ),
              ),
            ),
            if (!_signup) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _remember = !_remember),
                      child: Text(
                        'Se souvenir de moi',
                        style: AppTheme.sansText(
                          size: 14,
                          weight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                    ),
                  ),
                  Switch.adaptive(
                    value: _remember,
                    onChanged: (v) => setState(() => _remember = v),
                    activeThumbColor: Colors.white,
                    activeTrackColor: AppTheme.blue,
                  ),
                ],
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.push('/mot-de-passe-oublie'),
                  child: Text(
                    'Mot de passe oublié ?',
                    style: AppTheme.sansText(
                      size: 13,
                      weight: FontWeight.w700,
                      color: AppTheme.blue,
                    ),
                  ),
                ),
              ),
            ],
            CaptchaBlock(
              reloadToken: _captchaTick,
              onToken: (t) => setState(() => _turnstile = t),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              AuthErrorBanner(_error!),
            ],
            const SizedBox(height: 18),
            AuthPrimaryButton(
              label: _signup ? 'Créer mon compte' : 'Se connecter',
              busy: _busy,
              onPressed: _submit,
            ),
            GoogleSignInButton(
              busy: _busy,
              dividerLabel: _signup
                  ? 'Inscription rapide'
                  : 'Connexion rapide',
              onPressed: _submitGoogle,
            ),
          ],
        ),
      ),
    );
  }
}
