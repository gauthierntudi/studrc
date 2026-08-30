import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../widgets/cover.dart';

final purchasesProvider = FutureProvider((ref) {
  return ref.watch(apiClientProvider).purchases();
});

class PurchasesScreen extends ConsumerWidget {
  const PurchasesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(purchasesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Mes achats')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(ref.read(apiClientProvider).apiError(e)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('Aucun achat pour le moment.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, i) {
              final p = items[i];
              return ListTile(
                leading: SizedBox(
                  width: 48,
                  height: 64,
                  child: Cover(url: p.coverUrl, radius: 6),
                ),
                title: Text(p.title),
                trailing: const Icon(Icons.chevron_right),
                onTap: p.magazineId == null
                    ? null
                    : () => context.push('/magazine/${p.magazineId}'),
              );
            },
          );
        },
      ),
    );
  }
}
