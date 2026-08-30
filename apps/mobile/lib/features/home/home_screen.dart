import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/article_tile.dart';
import '../../widgets/cover.dart';

final homeProvider = FutureProvider((ref) async {
  final api = ref.watch(apiClientProvider);
  final feed = await api.home();
  MagazineCard? latest;
  try {
    latest = await api.latestMagazine();
  } catch (_) {}
  return (feed: feed, latest: latest);
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(homeProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('STUDRC', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.push('/recherche'),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _Retry(
          message: ref.read(apiClientProvider).apiError(e),
          onRetry: () => ref.refresh(homeProvider),
        ),
        data: (data) {
          final feed = data.feed;
          final featured = feed.featured.isNotEmpty
              ? feed.featured
              : feed.topGrid;
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(homeProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                if (featured.isNotEmpty) FeaturedCard(article: featured.first),
                if (featured.length > 1) ...[
                  const SizedBox(height: 16),
                  ...featured.skip(1).map((a) => ArticleTile(article: a)),
                ],
                if (data.latest != null) ...[
                  const SizedBox(height: 20),
                  _KiosqueTeaser(magazine: data.latest!),
                ],
                ...kRubriques.map((r) {
                  final items = switch (r.slug) {
                    'stu-news' => feed.stuNews,
                    'stu-data' => feed.stuData,
                    'stu-stories' => feed.stuStories,
                    'stu-talk' => feed.stuTalk,
                    _ => const <ArticleCard>[],
                  };
                  if (items.isEmpty) return const SizedBox.shrink();
                  return _RubriqueBlock(
                    label: r.label,
                    slug: r.slug,
                    tone: r.tone,
                    items: items.take(4).toList(),
                  );
                }),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _KiosqueTeaser extends StatelessWidget {
  const _KiosqueTeaser({required this.magazine});
  final MagazineCard magazine;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.go('/kiosque'),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            height: 96,
            child: Cover(url: magazine.coverUrl, radius: 8),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'STU MAG',
                  style: TextStyle(
                    color: AppTheme.gold,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
                Text(
                  magazine.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                TextButton(
                  onPressed: () => context.go('/kiosque'),
                  child: const Text('Voir le kiosque'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RubriqueBlock extends StatelessWidget {
  const _RubriqueBlock({
    required this.label,
    required this.slug,
    required this.tone,
    required this.items,
  });

  final String label;
  final String slug;
  final String tone;
  final List<ArticleCard> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 20),
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: AppTheme.toneColor(tone),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: AppTheme.toneColor(tone),
                ),
              ),
            ),
            TextButton(
              onPressed: () => context.push('/rubrique/$slug'),
              child: const Text('Tout voir'),
            ),
          ],
        ),
        ...items.map((a) => ArticleTile(article: a)),
      ],
    );
  }
}

class _Retry extends StatelessWidget {
  const _Retry({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Réessayer')),
          ],
        ),
      ),
    );
  }
}
