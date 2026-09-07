import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/article_nav.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../core/now_playing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/article_tile.dart';
import '../../widgets/cover.dart';
import '../../widgets/studrc_filter_tabs.dart';
import '../../widgets/studrc_masthead.dart';
import '../shorts/shorts_feed.dart';

final _newsTabLabels = <String>['Tous', ...kNewsRubriques.map((r) => r.label)];

final newsFeedProvider = FutureProvider.family<CategoryFeed, String>((
  ref,
  slug,
) {
  final api = ref.watch(apiClientProvider);
  if (slug.isEmpty) return api.feed(take: 30);
  return api.byCategory(slug, take: 30);
});

class NewsScreen extends ConsumerStatefulWidget {
  const NewsScreen({super.key});

  @override
  ConsumerState<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends ConsumerState<NewsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _newsTabLabels.length, vsync: this);
    _tabs.addListener(() {
      if (!mounted) return;
      setState(() {});
      if (_tabs.index == kNewsRubriques.length) {
        ref.read(nowPlayingProvider.notifier).stop();
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(shortsFeedProvider);
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider);
    final shortTab = _tabs.index == kNewsRubriques.length;
    final tabs = StudrcFilterTabs(controller: _tabs, labels: _newsTabLabels);

    ref.listen(shortsFeedProvider, (prev, next) {
      final items = next.valueOrNull?.items;
      if (items == null || !mounted) return;
      precacheShortPosters(context, items);
    });

    return Scaffold(
      backgroundColor: shortTab
          ? Colors.black
          : Theme.of(context).scaffoldBackgroundColor,
      body: Column(
        children: [
          if (!shortTab)
            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  StudrcMasthead(
                    onSearch: () => context.push('/recherche'),
                    onNotify: () => context.push(
                      user == null ? '/connexion' : '/notifications',
                    ),
                  ),
                  tabs,
                ],
              ),
            ),
          Expanded(
            child: Stack(
              children: [
                TabBarView(
                  controller: _tabs,
                  physics: shortTab
                      ? const NeverScrollableScrollPhysics()
                      : null,
                  children: [
                    const _NewsFeedPage(slug: ''),
                    for (final r in kNewsRubriques)
                      r.slug == 'stu-short'
                          ? ShortsFeedView(active: shortTab)
                          : _NewsFeedPage(slug: r.slug),
                  ],
                ),
                if (shortTab)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: DecoratedBox(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0xCC000000), Color(0x00000000)],
                        ),
                      ),
                      child: SafeArea(
                        bottom: false,
                        child: Theme(data: AppTheme.dark(), child: tabs),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NewsFeedPage extends ConsumerWidget {
  const _NewsFeedPage({required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(newsFeedProvider(slug));
    final portrait = isPortraitRubrique(slug);

    return async.when(
      loading: () => _NewsSkeleton(portrait: portrait),
      error: (e, _) => _NewsRetry(
        message: ref.read(apiClientProvider).apiError(e),
        onRetry: () => ref.refresh(newsFeedProvider(slug)),
      ),
      data: (feed) {
        if (feed.items.isEmpty) {
          return _NewsRetry(
            message: 'Pas encore d’articles ici.',
            onRetry: () => ref.refresh(newsFeedProvider(slug)),
            retryLabel: 'Actualiser',
          );
        }
        return RefreshIndicator(
          color: AppTheme.gold,
          onRefresh: () async => ref.refresh(newsFeedProvider(slug).future),
          child: portrait
              ? _PortraitNewsList(items: feed.items)
              : _EditorialNewsList(
                  items: feed.items,
                  showMeta: slug.isEmpty,
                  showExcerpt: slug == 'stu-news' || slug == 'stu-data',
                ),
        );
      },
    );
  }
}

class _EditorialNewsList extends StatelessWidget {
  const _EditorialNewsList({
    required this.items,
    required this.showMeta,
    this.showExcerpt = false,
  });

  final List<ArticleCard> items;
  final bool showMeta;
  final bool showExcerpt;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      itemCount: items.length,
      itemBuilder: (context, i) {
        if (i == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: FeaturedCard(
              article: items[i],
              showExcerpt: showExcerpt,
            ),
          );
        }
        return ArticleTile(
          article: items[i],
          showMeta: showMeta,
          showExcerpt: showExcerpt,
        );
      },
    );
  }
}

class _PortraitNewsList extends StatelessWidget {
  const _PortraitNewsList({required this.items});

  final List<ArticleCard> items;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        const pad = 20.0;
        final width = constraints.maxWidth - pad * 2;
        final cardWidth = (width - gap) / 2;
        final coverHeight = cardWidth * 4 / 3;
        return ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(pad, 16, pad, 40),
          children: [
            Wrap(
              spacing: gap,
              runSpacing: 16,
              children: [
                for (final article in items)
                  SizedBox(
                    width: cardWidth,
                    child: _PortraitNewsCard(
                      article: article,
                      width: cardWidth,
                      coverHeight: coverHeight,
                    ),
                  ),
              ],
            ),
          ],
        );
      },
    );
  }
}

class _PortraitNewsCard extends StatelessWidget {
  const _PortraitNewsCard({
    required this.article,
    required this.width,
    required this.coverHeight,
  });

  final ArticleCard article;
  final double width;
  final double coverHeight;

  @override
  Widget build(BuildContext context) {
    final video =
        isVideoRubrique(article.category, article.categoryLabel) ||
        article.hasReadyVideo;
    final clock = article.durationClock;
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: width,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => openArticleCard(context, article),
          borderRadius: BorderRadius.circular(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Cover(
                url: article.videoPosterUrl ?? article.coverUrl,
                play: video && clock.isEmpty,
                duration: clock,
                height: coverHeight,
                radius: 16,
              ),
              const SizedBox(height: 8),
              Text(
                article.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTheme.displayText(
                  size: 13,
                  weight: FontWeight.w700,
                  height: 1.3,
                  color: scheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NewsSkeleton extends StatelessWidget {
  const _NewsSkeleton({required this.portrait});

  final bool portrait;

  @override
  Widget build(BuildContext context) {
    final fill = Theme.of(context).colorScheme.surfaceContainerHighest;
    Widget box({double h = 16, double r = 10}) => Container(
      height: h,
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(r),
      ),
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: portrait
          ? Column(
              children: [
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: box(h: 220, r: 16)),
                      const SizedBox(width: 12),
                      Expanded(child: box(h: 220, r: 16)),
                    ],
                  ),
                ),
              ],
            )
          : Column(
              children: [
                AspectRatio(
                  aspectRatio: 4 / 3,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: fill,
                      borderRadius: BorderRadius.circular(22),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    SizedBox(width: 88 * 4 / 3, child: box(h: 88, r: 12)),
                    const SizedBox(width: 14),
                    Expanded(child: box(h: 56, r: 12)),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    SizedBox(width: 88 * 4 / 3, child: box(h: 88, r: 12)),
                    const SizedBox(width: 14),
                    Expanded(child: box(h: 56, r: 12)),
                  ],
                ),
              ],
            ),
    );
  }
}

class _NewsRetry extends StatelessWidget {
  const _NewsRetry({
    required this.message,
    required this.onRetry,
    this.retryLabel = 'Réessayer',
  });

  final String message;
  final VoidCallback onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.sansText(
                size: 15,
                height: 1.45,
                color: scheme.onSurface.withValues(alpha: 0.7),
              ),
            ),
            const SizedBox(height: 14),
            FilledButton(onPressed: onRetry, child: Text(retryLabel)),
          ],
        ),
      ),
    );
  }
}
