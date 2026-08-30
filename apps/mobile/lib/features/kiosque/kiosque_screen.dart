import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/models.dart';
import '../../widgets/cover.dart';

final kiosqueProvider = FutureProvider((ref) {
  return ref.watch(apiClientProvider).magazines(take: 30);
});

class KiosqueScreen extends ConsumerWidget {
  const KiosqueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(kiosqueProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Kiosque')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(ref.read(apiClientProvider).apiError(e)),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('Aucun magazine publié.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(kiosqueProvider.future),
            child: GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.62,
                crossAxisSpacing: 12,
                mainAxisSpacing: 16,
              ),
              itemCount: items.length,
              itemBuilder: (context, i) => _MagCard(magazine: items[i]),
            ),
          );
        },
      ),
    );
  }
}

class _MagCard extends StatelessWidget {
  const _MagCard({required this.magazine});
  final MagazineCard magazine;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/magazine/${magazine.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Cover(url: magazine.coverUrl, radius: 10)),
          const SizedBox(height: 8),
          Text(
            magazine.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          Text(
            [
              if (magazine.issueNumber != null) 'n° ${magazine.issueNumber}',
              if (magazine.accessType == 'FREE') 'Gratuit',
              if (magazine.dateLabel.isNotEmpty) magazine.dateLabel,
            ].join(' · '),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
