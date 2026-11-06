import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:studrc/widgets/app_icons.dart';
import '../../core/api.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_shell.dart';
import '../../widgets/avatar_editor.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  late String _initialName;
  late String _initialEmail;
  late String _initialPhone;
  bool _busy = false;
  bool _uploading = false;
  String? _error;
  String? _ok;

  @override
  void initState() {
    super.initState();
    final user = ref.read(sessionProvider);
    _initialName = user?.name ?? '';
    _initialEmail = user?.email ?? '';
    _initialPhone = user?.phone ?? '';
    _name = TextEditingController(text: _initialName);
    _email = TextEditingController(text: _initialEmail);
    _phone = TextEditingController(text: _initialPhone);
    _name.addListener(_onChanged);
    _email.addListener(_onChanged);
    _phone.addListener(_onChanged);
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _onChanged() {
    setState(() => _ok = null);
  }

  bool get _dirty =>
      _name.text.trim() != _initialName ||
      _email.text.trim() != _initialEmail ||
      _phone.text.trim() != _initialPhone;

  Future<void> _changePhoto() async {
    final path = await pickAndCropAvatar(context);
    if (path == null || !mounted) return;
    setState(() {
      _uploading = true;
      _error = null;
      _ok = null;
    });
    try {
      await ref.read(sessionProvider.notifier).uploadAvatar(path);
      if (mounted) setState(() => _ok = 'Photo de profil mise à jour');
    } catch (e) {
      if (mounted) {
        setState(() => _error = ref.read(apiClientProvider).apiError(e));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final email = _email.text.trim();
    if (name.isEmpty || email.isEmpty) {
      setState(() => _error = 'Le nom et l’e-mail sont obligatoires.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _ok = null;
    });
    try {
      await ref.read(apiClientProvider).updateProfile(
            name: name,
            email: email,
            phone: _phone.text.trim(),
          );
      await ref.read(sessionProvider.notifier).refreshMe();
      final user = ref.read(sessionProvider);
      _initialName = user?.name ?? name;
      _initialEmail = user?.email ?? email;
      _initialPhone = user?.phone ?? _phone.text.trim();
      if (mounted) setState(() => _ok = 'Profil mis à jour');
    } catch (e) {
      setState(() => _error = ref.read(apiClientProvider).apiError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _onPop(bool didPop, Object? result) async {
    if (didPop || !_dirty || _busy) return;
    final leave = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Quitter sans enregistrer ?'),
          content: const Text(
            'Les modifications du profil ne seront pas sauvegardées.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Rester'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Quitter'),
            ),
          ],
        );
      },
    );
    if (leave == true && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider);
    final canSave = _dirty && !_busy;

    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: _onPop,
      child: Scaffold(
        appBar: AppBar(title: const Text('Modifier le profil')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 36),
          children: [
            Center(
              child: Column(
                children: [
                  ProfileAvatar(
                    url: user?.avatarUrl,
                    name: user?.name ?? _name.text,
                    size: 112,
                    uploading: _uploading,
                    onEdit: _uploading ? null : _changePhoto,
                  ),
                  const SizedBox(height: 4),
                  TextButton(
                    onPressed: _uploading ? null : _changePhoto,
                    child: Text(
                      'Changer la photo',
                      style: AppTheme.sansText(
                        size: 14,
                        weight: FontWeight.w800,
                        color: AppTheme.gold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            AuthGlassField(
              controller: _name,
              hint: 'Entrez votre nom',
              icon: AppIcons.userRound,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.name],
            ),
            const SizedBox(height: 14),
            AuthGlassField(
              controller: _email,
              hint: 'Entrez votre e-mail',
              icon: AppIcons.mail,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
            ),
            const SizedBox(height: 14),
            AuthGlassField(
              controller: _phone,
              hint: 'Téléphone (optionnel)',
              icon: AppIcons.phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) {
                if (canSave) _save();
              },
              autofillHints: const [AutofillHints.telephoneNumber],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              AuthErrorBanner(_error!),
            ],
            if (_ok != null) ...[
              const SizedBox(height: 12),
              AuthNotice(_ok!),
            ],
            const SizedBox(height: 18),
            AuthPrimaryButton(
              label: 'Enregistrer',
              busy: _busy,
              onPressed: canSave ? _save : null,
            ),
          ],
        ),
      ),
    );
  }
}
