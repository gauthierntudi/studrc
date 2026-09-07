import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../widgets/article_tile.dart';
import '../shorts/shorts_feed.dart';

final rubriqueProvider =
    FutureProvider.family((ref, String slug) {
  return ref.watch(apiClientProvider).byCategory(slug, take: 24);
});

class RubriqueScreen extends ConsumerWidget {
  const RubriqueScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (isShortRubrique(slug)) {
      return const ShortsScreen();
    }
    final async = ref.watch(rubriqueProvider(slug));
    return Scaffold(
      appBar: AppBar(
        title: Text(
          capitalizeLabel(async.valueOrNull?.label ?? slug),
        ),
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
          final chapo = slug == 'stu-news' || slug == 'stu-data';
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            itemCount: feed.items.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              if (i == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: FeaturedCard(
                    article: feed.items[i],
                    showExcerpt: chapo,
                  ),
                );
              }
              return ArticleTile(
                article: feed.items[i],
                showExcerpt: chapo,
              );
            },
          );
        },
      ),
    );
  }
}
