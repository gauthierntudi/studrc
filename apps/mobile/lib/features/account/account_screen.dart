import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:studrc/widgets/app_icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api.dart';
import '../../core/appearance.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../core/notifications.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_shell.dart';
import '../../widgets/avatar_editor.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider);
    if (user == null || user.email.isEmpty) {
      return const Scaffold(body: _SignedOut());
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Compte')),
      body: _SignedIn(user: user),
    );
  }
}

class _SignedOut extends StatelessWidget {
  const _SignedOut();

  @override
  Widget build(BuildContext context) {
    const ink = Colors.white;
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/onboarding/2151031917.jpg',
          fit: BoxFit.cover,
          alignment: const Alignment(0, -0.12),
        ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0x3300132B),
                Color(0x6600132B),
                Color(0xE600132B),
              ],
              stops: [0, 0.45, 1],
            ),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
            child: Column(
              children: [
                const Spacer(),
                Text(
                  'Votre espace STUDRC',
                  textAlign: TextAlign.center,
                  style: AppTheme.displayText(
                    size: 24,
                    weight: FontWeight.w800,
                    color: ink,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Connectez-vous pour vos achats, notifications et la lecture des magazines.',
                  textAlign: TextAlign.center,
                  style: AppTheme.sansText(
                    size: 15,
                    height: 1.45,
                    color: ink.withValues(alpha: 0.78),
                  ),
                ),
                const SizedBox(height: 28),
                AuthPrimaryButton(
                  label: 'Se connecter',
                  onPressed: () => context.push('/connexion'),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: OutlinedButton(
                    onPressed: () => context.push('/inscription'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: ink,
                      side: BorderSide(color: ink.withValues(alpha: 0.45)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      'Créer un compte',
                      style: AppTheme.sansText(
                        size: 16,
                        weight: FontWeight.w700,
                        color: ink,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SignedIn extends ConsumerStatefulWidget {
  const _SignedIn({required this.user});

  final Subscriber user;

  @override
  ConsumerState<_SignedIn> createState() => _SignedInState();
}

class _SignedInState extends ConsumerState<_SignedIn> {
  bool _uploading = false;

  Future<void> _changePhoto() async {
    final path = await pickAndCropAvatar(context);
    if (path == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      await ref.read(sessionProvider.notifier).uploadAvatar(path);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Photo de profil mise à jour')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.read(apiClientProvider).apiError(e))),
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _openSite(String path) async {
    final uri = Uri.parse('$kSiteUrl$path');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _confirmLogout() async {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final go = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: dark ? const Color(0xFF0A2A4C) : Colors.white,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Se déconnecter ?',
                  style: AppTheme.displayText(
                    size: 20,
                    weight: FontWeight.w800,
                    color: scheme.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Vous pourrez vous reconnecter à tout moment.',
                  textAlign: TextAlign.center,
                  style: AppTheme.sansText(
                    size: 14,
                    color: scheme.onSurface.withValues(alpha: 0.55),
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context, true),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.red,
                      foregroundColor: Colors.white,
                      shape: const StadiumBorder(),
                    ),
                    child: const Text('Se déconnecter'),
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Annuler'),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (go == true && mounted) {
      HapticFeedback.lightImpact();
      await ref.read(sessionProvider.notifier).logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider) ?? widget.user;
    final appearance = ref.watch(appearanceProvider);
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final muted = scheme.onSurface.withValues(alpha: 0.55);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 36),
      children: [
        _ProfileCard(
          user: user,
          uploading: _uploading,
          onPhoto: _changePhoto,
          onEdit: () => context.push('/profil'),
        ),
        const SizedBox(height: 22),
        _SectionLabel(label: 'Préférences'),
        _SettingsGroup(
          children: [
            _ToggleTile(
              icon: AppIcons.bellOff,
              label: 'Pause notifications',
              subtitle: 'Couper les alertes dans l’app',
              value: appearance.notificationsPaused,
              onChanged: (v) {
                HapticFeedback.selectionClick();
                ref.read(appearanceProvider).setNotificationsPaused(v);
              },
            ),
            _ToggleTile(
              icon: AppIcons.moon,
              label: 'Dark mode',
              subtitle: 'Thème sombre de l’application',
              value: appearance.darkEnabled(context),
              onChanged: (v) {
                HapticFeedback.selectionClick();
                ref.read(appearanceProvider).setDarkMode(v);
              },
            ),
          ],
        ),
        const SizedBox(height: 20),
        _SectionLabel(label: 'Votre espace'),
        _SettingsGroup(
          children: [
            _SettingsTile(
              icon: AppIcons.bell,
              label: 'Notifications',
              badge: ref.watch(unreadNotificationsProvider).valueOrNull ?? 0,
              onTap: () => context.push('/notifications'),
            ),
            _SettingsTile(
              icon: AppIcons.shoppingBag,
              label: 'Mes achats',
              onTap: () => context.push('/achats'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        _SectionLabel(label: 'Légal'),
        _SettingsGroup(
          children: [
            _SettingsTile(
              icon: AppIcons.shield,
              label: 'Confidentialité',
              onTap: () => _openSite('/confidentialite'),
            ),
            _SettingsTile(
              icon: AppIcons.fileText,
              label: 'Conditions d’utilisation',
              onTap: () => _openSite('/conditions-utilisation'),
            ),
          ],
        ),
        const SizedBox(height: 28),
        SizedBox(
          height: 54,
          child: FilledButton(
            onPressed: _confirmLogout,
            style: FilledButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppTheme.red,
              elevation: dark ? 0 : 1,
              shadowColor: Colors.black.withValues(alpha: 0.08),
              shape: const StadiumBorder(),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(AppIcons.logOut, size: 20),
                const SizedBox(width: 8),
                Text(
                  'Se déconnecter',
                  style: AppTheme.sansText(
                    size: 16,
                    weight: FontWeight.w800,
                    color: AppTheme.red,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'STUDRC',
          textAlign: TextAlign.center,
          style: AppTheme.sansText(size: 12, color: muted),
        ),
      ],
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.user,
    required this.uploading,
    required this.onPhoto,
    required this.onEdit,
  });

  final Subscriber user;
  final bool uploading;
  final VoidCallback onPhoto;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = Theme.of(context).colorScheme.onSurface;
    final muted = ink.withValues(alpha: 0.55);

    return Material(
      color: dark ? const Color(0xFF0A2A4C) : Colors.white,
      elevation: dark ? 0 : 1,
      shadowColor: Colors.black.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(22),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 20, 12, 18),
        child: Row(
          children: [
            ProfileAvatar(
              url: user.avatarUrl,
              name: user.name,
              size: 76,
              uploading: uploading,
              onEdit: onPhoto,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: InkWell(
                onTap: onEdit,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.sansText(
                          size: 18,
                          weight: FontWeight.w800,
                          color: ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user.email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.sansText(size: 13, color: muted),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Modifier le profil',
                        style: AppTheme.sansText(
                          size: 13,
                          weight: FontWeight.w700,
                          color: AppTheme.gold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            IconButton(
              onPressed: onEdit,
              tooltip: 'Modifier le profil',
              icon: Icon(
                AppIcons.chevronRight,
                color: muted,
                size: 20,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
      child: Text(
        label.toUpperCase(),
        style: AppTheme.sansText(
          size: 12,
          weight: FontWeight.w800,
          letterSpacing: 0.6,
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45),
        ),
      ),
    );
  }
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          Material(
            color: dark ? const Color(0xFF0A2A4C) : Colors.white,
            elevation: dark ? 0 : 1,
            shadowColor: Colors.black.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(18),
            clipBehavior: Clip.antiAlias,
            child: children[i],
          ),
        ],
      ],
    );
  }
}

class _IconBadge extends StatelessWidget {
  const _IconBadge({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: dark
            ? AppTheme.gold.withValues(alpha: 0.16)
            : const Color(0xFFF4F6F8),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(
        icon,
        size: 18,
        color: dark ? AppTheme.gold : AppTheme.navy,
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final ink = Theme.of(context).colorScheme.onSurface;
    return ListTile(
      onTap: onTap,
      minVerticalPadding: 14,
      leading: _IconBadge(icon: icon),
      title: Text(
        label,
        style: AppTheme.sansText(size: 16, weight: FontWeight.w600, color: ink),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (badge > 0) ...[
            Align(
              heightFactor: 1,
              child: UnreadBadge(count: badge),
            ),
            const SizedBox(width: 10),
          ],
          Icon(
            AppIcons.chevronRight,
            size: 18,
            color: ink.withValues(alpha: 0.35),
          ),
        ],
      ),
    );
  }
}

class _ToggleTile extends StatelessWidget {
  const _ToggleTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final ink = Theme.of(context).colorScheme.onSurface;
    return ListTile(
      onTap: () => onChanged(!value),
      minVerticalPadding: 12,
      leading: _IconBadge(icon: icon),
      title: Text(
        label,
        style: AppTheme.sansText(size: 16, weight: FontWeight.w600, color: ink),
      ),
      subtitle: Text(
        subtitle,
        style: AppTheme.sansText(
          size: 12.5,
          color: ink.withValues(alpha: 0.5),
        ),
      ),
      trailing: Switch.adaptive(
        value: value,
        onChanged: onChanged,
      ),
    );
  }
}
