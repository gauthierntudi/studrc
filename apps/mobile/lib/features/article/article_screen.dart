import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/article_tile.dart';
import '../../widgets/cover.dart';
import '../../widgets/studrc_video_player.dart';

final articleProvider = FutureProvider.family((ref, String slug) {
  return ref.watch(apiClientProvider).article(slug);
});

final relatedProvider = FutureProvider.family((ref, String slug) {
  return ref.watch(apiClientProvider).related(slug);
});

class ArticleScreen extends ConsumerWidget {
  const ArticleScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(articleProvider(slug));
    return async.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: Center(child: Text(ref.read(apiClientProvider).apiError(e))),
      ),
      data: (article) => article.hasReadyVideo
          ? _VideoWatchView(article: article)
          : _ArticleView(article: article),
    );
  }
}

class _VideoWatchView extends ConsumerWidget {
  const _VideoWatchView({required this.article});

  final ArticleDetail article;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final related = ref.watch(relatedProvider(article.slug));
    final date = _dateLabel(article.publishedAt);
    final scheme = Theme.of(context).colorScheme;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: Column(
          children: [
            ColoredBox(
              color: Colors.black,
              child: SafeArea(
                bottom: false,
                child: Stack(
                  children: [
                    StudrcVideoPlayer(
                      src: article.videoHlsUrl!,
                      poster: article.videoPosterUrl ?? article.coverUrl,
                      radius: 0,
                    ),
                    Positioned(
                      top: 4,
                      left: 4,
                      child: IconButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        tooltip: 'Retour',
                        style: IconButton.styleFrom(
                          foregroundColor: Colors.white,
                          backgroundColor: Colors.black.withValues(alpha: 0.35),
                          minimumSize: const Size(44, 44),
                        ),
                        icon: const Icon(Icons.arrow_back_rounded),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
                children: [
                  if ((article.category ?? article.categoryLabel) != null)
                    Text(
                      capitalizeLabel(
                        article.categoryLabel ?? article.category ?? '',
                      ),
                      style: AppTheme.sansText(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppTheme.gold,
                      ),
                    ),
                  const SizedBox(height: 6),
                  Text(
                    article.title,
                    style: AppTheme.displayText(
                      size: 22,
                      weight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                  if (article.authorName != null || date != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      [article.authorName, date]
                          .whereType<String>()
                          .join(' · '),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  if (article.excerpt != null &&
                      article.excerpt!.trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      article.excerpt!,
                      style: AppTheme.sansText(
                        size: 15,
                        height: 1.5,
                        color: scheme.onSurface.withValues(alpha: 0.82),
                      ),
                    ),
                  ],
                  if (_hasBody(article)) ...[
                    const SizedBox(height: 16),
                    _ArticleHtml(article: article),
                  ],
                  related.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.only(top: 32),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (items) {
                      final videos = items
                          .where((a) => a.hasReadyVideo)
                          .toList();
                      final articles = items
                          .where((a) => !a.hasReadyVideo)
                          .toList();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (videos.isNotEmpty) ...[
                            const SizedBox(height: 28),
                            Text(
                              'À suivre',
                              style: AppTheme.displayText(
                                size: 18,
                                weight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 8),
                            ...videos.map((a) => _RelatedVideoTile(article: a)),
                          ],
                          if (articles.isNotEmpty) ...[
                            const SizedBox(height: 24),
                            Text(
                              'Articles',
                              style: AppTheme.displayText(
                                size: 18,
                                weight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 12),
                            _RelatedArticleRail(articles: articles),
                          ],
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArticleView extends ConsumerWidget {
  const _ArticleView({required this.article});

  final ArticleDetail article;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final related = ref.watch(relatedProvider(article.slug));
    final date = _dateLabel(article.publishedAt);

    return Scaffold(
      appBar: AppBar(title: const Text('Article')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        children: [
          if ((article.category ?? article.categoryLabel) != null)
            Text(
              capitalizeLabel(article.categoryLabel ?? article.category ?? ''),
              style: AppTheme.sansText(
                size: 12,
                weight: FontWeight.w800,
                color: AppTheme.toneColor(
                  isVideoRubrique(article.category) ? 'gold' : 'red',
                ),
              ),
            ),
          const SizedBox(height: 8),
          Text(
            article.title,
            style: AppTheme.displayText(
              size: 26,
              weight: FontWeight.w800,
              height: 1.15,
            ),
          ),
          if (article.authorName != null || date != null) ...[
            const SizedBox(height: 8),
            Text(
              [article.authorName, date].whereType<String>().join(' · '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (article.excerpt != null && article.excerpt!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              article.excerpt!,
              style: AppTheme.sansText(size: 17, height: 1.5),
            ),
          ],
          const SizedBox(height: 16),
          if (article.coverUrl != null) Cover(url: article.coverUrl, height: 220),
          const SizedBox(height: 20),
          _ArticleHtml(article: article),
          related.when(
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
            data: (items) {
              if (items.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 28),
                  Text(
                    'À lire aussi',
                    style: AppTheme.displayText(
                      size: 18,
                      weight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...items.map((a) => ArticleTile(article: a, compact: true)),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _RelatedVideoTile extends StatelessWidget {
  const _RelatedVideoTile({required this.article});

  final ArticleCard article;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final minutes = article.durationLabel;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(
          '/article/${Uri.encodeComponent(article.slug)}',
        ),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 168,
                height: 94,
                child: Cover(
                  url: article.videoPosterUrl ?? article.coverUrl,
                  height: 94,
                  radius: 10,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      article.title,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.displayText(
                        size: 15,
                        weight: FontWeight.w700,
                        height: 1.25,
                        color: scheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        if (minutes.isNotEmpty) minutes,
                        if (article.categoryLabel.isNotEmpty)
                          capitalizeLabel(article.categoryLabel),
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.sansText(
                        size: 12,
                        color: scheme.onSurface.withValues(alpha: 0.55),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RelatedArticleRail extends StatelessWidget {
  const _RelatedArticleRail({required this.articles});

  final List<ArticleCard> articles;

  @override
  Widget build(BuildContext context) {
    const gap = 10.0;
    final available = MediaQuery.sizeOf(context).width - 32;
    final cardWidth = (available - 2 * gap) / 2.5;
    final coverHeight = cardWidth * 4 / 3;

    return SizedBox(
      height: coverHeight + 68,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: articles.length,
        separatorBuilder: (_, _) => const SizedBox(width: gap),
        itemBuilder: (context, i) {
          final article = articles[i];
          return SizedBox(
            width: cardWidth,
            child: _PortraitArticleCard(
              article: article,
              coverHeight: coverHeight,
            ),
          );
        },
      ),
    );
  }
}

class _PortraitArticleCard extends StatelessWidget {
  const _PortraitArticleCard({
    required this.article,
    required this.coverHeight,
  });

  final ArticleCard article;
  final double coverHeight;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(
          '/article/${Uri.encodeComponent(article.slug)}',
        ),
        borderRadius: BorderRadius.circular(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Cover(
              url: article.coverUrl,
              height: coverHeight,
              radius: 14,
            ),
            const SizedBox(height: 8),
            Text(
              article.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.displayText(
                size: 13,
                weight: FontWeight.w700,
                height: 1.25,
                color: scheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArticleHtml extends StatelessWidget {
  const _ArticleHtml({required this.article});

  final ArticleDetail article;

  @override
  Widget build(BuildContext context) {
    if (article.blocks.isNotEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final b in article.blocks)
            Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (b.title != null && b.title!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        b.title!,
                        style: AppTheme.displayText(
                          size: 20,
                          weight: FontWeight.w800,
                        ),
                      ),
                    ),
                  if (b.coverUrl != null) ...[
                    Cover(url: b.coverUrl, height: 180, radius: 8),
                    const SizedBox(height: 10),
                  ],
                  HtmlWidget(
                    b.content,
                    textStyle: AppTheme.sansText(size: 16, height: 1.55),
                  ),
                ],
              ),
            ),
        ],
      );
    }
    if (article.content.isNotEmpty) {
      return HtmlWidget(
        article.content,
        textStyle: AppTheme.sansText(size: 16, height: 1.55),
      );
    }
    return const SizedBox.shrink();
  }
}

bool _hasBody(ArticleDetail article) {
  return article.blocks.isNotEmpty || article.content.isNotEmpty;
}

String? _dateLabel(String? publishedAt) {
  if (publishedAt == null) return null;
  return DateFormat('d MMMM y', 'fr').format(
    DateTime.tryParse(publishedAt) ?? DateTime.now(),
  );
}
