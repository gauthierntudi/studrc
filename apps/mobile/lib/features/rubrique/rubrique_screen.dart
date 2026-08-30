import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api.dart';
import '../../widgets/article_tile.dart';

final rubriqueProvider =
    FutureProvider.family((ref, String slug) {
  return ref.watch(apiClientProvider).byCategory(slug, take: 24);
});

class RubriqueScreen extends ConsumerWidget {
  const RubriqueScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(rubriqueProvider(slug));
    return Scaffold(
      appBar: AppBar(
        title: Text(async.valueOrNull?.label ?? slug.toUpperCase()),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(ref.read(apiClientProvider).apiError(e)),
        ),
        data: (feed) {
          if (feed.items.isEmpty) {
            return const Center(child: Text('Pas encore d’articles.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            itemCount: feed.items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              if (i == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: FeaturedCard(article: feed.items[i]),
                );
              }
              return ArticleTile(article: feed.items[i]);
            },
          );
        },
      ),
    );
  }
}
