import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';

final notificationsProvider = FutureProvider((ref) {
  return ref.watch(apiClientProvider).notifications();
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(ref.read(apiClientProvider).apiError(e), textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => context.push('/connexion'),
                  child: const Text('Se connecter'),
                ),
              ],
            ),
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('Aucune notification.'));
          }
          return ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final n = items[i];
              return ListTile(
                title: Text(n.title),
                subtitle: n.body == null ? null : Text(n.body!),
                trailing: n.read ? null : const Icon(Icons.circle, size: 10),
                onTap: () async {
                  if (!n.read && n.id.isNotEmpty) {
                    await ref.read(apiClientProvider).markNotificationRead(n.id);
                    ref.invalidate(notificationsProvider);
                  }
                },
              );
            },
          );
        },
      ),
    );
  }
}
