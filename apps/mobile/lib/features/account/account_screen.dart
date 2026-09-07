import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_shell.dart';
import '../../widgets/studrc_logo.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Compte')),
      body: user == null ? const _SignedOut() : _SignedIn(user: user),
    );
  }
}

class _SignedOut extends StatelessWidget {
  const _SignedOut();

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = dark ? Colors.white : AppTheme.navy;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
      child: Column(
        children: [
          const Spacer(),
          StudrcLogo(height: 28, color: ink),
          const SizedBox(height: 20),
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
              color: ink.withValues(alpha: 0.55),
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
                side: BorderSide(color: ink.withValues(alpha: 0.18)),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(28),
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
          const Spacer(flex: 2),
        ],
      ),
    );
  }
}

class _SignedIn extends ConsumerWidget {
  const _SignedIn({required this.user});

  final Subscriber user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      children: [
        ListTile(
          leading: CircleAvatar(
            backgroundImage: user.avatarUrl != null
                ? NetworkImage(user.avatarUrl!)
                : null,
            child: user.avatarUrl == null
                ? Text(user.name.isEmpty ? '?' : user.name[0].toUpperCase())
                : null,
          ),
          title: Text(user.name),
          subtitle: Text(user.email),
        ),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.person_outline),
          title: const Text('Profil'),
          onTap: () => context.push('/profil'),
        ),
        ListTile(
          leading: const Icon(Icons.notifications_outlined),
          title: const Text('Notifications'),
          onTap: () => context.push('/notifications'),
        ),
        ListTile(
          leading: const Icon(Icons.shopping_bag_outlined),
          title: const Text('Mes achats'),
          onTap: () => context.push('/achats'),
        ),
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('Se déconnecter'),
          onTap: () => ref.read(sessionProvider.notifier).logout(),
        ),
      ],
    );
  }
}
