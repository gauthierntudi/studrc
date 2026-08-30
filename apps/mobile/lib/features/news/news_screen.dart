import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../widgets/article_tile.dart';

final newsProvider = FutureProvider((ref) {
  return ref.watch(apiClientProvider).feed(take: 20);
});

class NewsScreen extends ConsumerWidget {
  const NewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(newsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Actualités'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.push('/recherche'),
          ),
        ],
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
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(newsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              itemCount: feed.items.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) => ArticleTile(article: feed.items[i]),
            ),
          );
        },
      ),
    );
  }
}
