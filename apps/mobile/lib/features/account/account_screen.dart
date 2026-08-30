import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Compte')),
      body: user == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Connectez-vous pour vos achats, notifications et la lecture des magazines.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => context.push('/connexion'),
                      child: const Text('Se connecter'),
                    ),
                    TextButton(
                      onPressed: () => context.push('/inscription'),
                      child: const Text('Créer un compte'),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
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
            ),
    );
  }
}
