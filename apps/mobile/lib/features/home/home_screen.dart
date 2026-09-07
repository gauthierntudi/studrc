import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
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

final homeProvider = FutureProvider((ref) async {
  final api = ref.watch(apiClientProvider);
  final feed = await api.home();
  var magazines = <MagazineCard>[];
  try {
    magazines = await api.magazines(take: 12);
  } catch (_) {
    try {
      final latest = await api.latestMagazine();
      if (latest != null) magazines = [latest];
    } catch (_) {}
  }
  return (feed: feed, magazines: magazines);
});

List<ArticleCard> _unique(Iterable<ArticleCard> items) {
  final seen = <String>{};
  return [
    for (final a in items)
      if (seen.add(a.id)) a,
  ];
}

final _tabLabels = <String>[
  'À la une',
  ...kRubriques.map((r) => r.label),
  'Shorts',
];

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _tabLabels.length, vsync: this);
    _tabs.addListener(() {
      if (!mounted) return;
      setState(() {});
      if (_tabs.index == _tabLabels.length - 1) {
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
    final async = ref.watch(homeProvider);
    final user = ref.watch(sessionProvider);
    final shortTab = _tabs.index == _tabLabels.length - 1;
    final tabs = StudrcFilterTabs(controller: _tabs, labels: _tabLabels);

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
                async.when(
                  loading: () => shortTab
                      ? ShortsFeedView(active: true)
                      : const _HomeSkeleton(),
                  error: (e, _) => shortTab
                      ? ShortsFeedView(active: true)
                      : _Retry(
                          message: ref.read(apiClientProvider).apiError(e),
                          onRetry: () => ref.refresh(homeProvider),
                        ),
                  data: (data) {
                    final feed = data.feed;
                    final une = _unique([...feed.featured, ...feed.topGrid]);
                    final byRubrique = [
                      feed.stuNews,
                      feed.stuData,
                      feed.stuStories,
                      feed.stuTalk,
                    ];
                    return TabBarView(
                      controller: _tabs,
                      physics: shortTab
                          ? const NeverScrollableScrollPhysics()
                          : null,
                      children: [
                        _UnePage(
                          une: une,
                          feed: feed,
                          magazines: data.magazines,
                          onRefresh: () async =>
                              ref.refresh(homeProvider.future),
                        ),
                        for (var i = 0; i < kRubriques.length; i++)
                          _RubriquePage(
                            items: byRubrique[i],
                            slug: kRubriques[i].slug,
                            onRefresh: () async =>
                                ref.refresh(homeProvider.future),
                          ),
                        ShortsFeedView(active: shortTab),
                      ],
                    );
                  },
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

class _UnePage extends StatelessWidget {
  const _UnePage({
    required this.une,
    required this.feed,
    required this.magazines,
    required this.onRefresh,
  });

  final List<ArticleCard> une;
  final HomeFeed feed;
  final List<MagazineCard> magazines;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final rails = kRubriques.map((r) {
      final items = switch (r.slug) {
        'stu-news' => feed.stuNews,
        'stu-data' => feed.stuData,
        'stu-stories' => feed.stuStories,
        'stu-talk' => feed.stuTalk,
        _ => const <ArticleCard>[],
      };
      return (slug: r.slug, label: r.label, tone: r.tone, items: items);
    });

    return RefreshIndicator(
      color: AppTheme.gold,
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
        children: [
          if (une.isNotEmpty) FeaturedCard(article: une.first),
          if (une.length > 1) ...[
            const SizedBox(height: 20),
            _CoverRail(items: une.skip(1).take(10).toList()),
          ],
          ...rails
              .where((r) => r.items.isNotEmpty)
              .map(
                (r) =>                 _RubriqueRail(
                  label: r.label,
                  slug: r.slug,
                  tone: r.tone,
                  items: r.items.take(10).toList(),
                ),
              ),
          if (magazines.isNotEmpty) _StuMagRail(magazines: magazines),
        ],
      ),
    );
  }
}

class _RubriquePage extends StatelessWidget {
  const _RubriquePage({
    required this.items,
    required this.slug,
    required this.onRefresh,
  });

  final List<ArticleCard> items;
  final String slug;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (items.isEmpty) {
      return Center(
        child: Text(
          'Rien à afficher ici.',
          style: AppTheme.sansText(
            color: scheme.onSurface.withValues(alpha: 0.6),
          ),
        ),
      );
    }

    return RefreshIndicator(
      color: AppTheme.gold,
      onRefresh: onRefresh,
      child: isPortraitRubrique(slug)
          ? _PortraitRubriqueList(items: items, slug: slug)
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
              children: [
                FeaturedCard(article: items.first, showExcerpt: true),
                const SizedBox(height: 8),
                ...items.skip(1).map(
                  (a) => ArticleTile(
                    article: a,
                    showMeta: false,
                    showExcerpt: true,
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => context.push('/rubrique/$slug'),
                  child: const Text('Voir toute la rubrique'),
                ),
              ],
            ),
    );
  }
}

class _PortraitRubriqueList extends StatelessWidget {
  const _PortraitRubriqueList({required this.items, required this.slug});

  final List<ArticleCard> items;
  final String slug;

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
                    child: _CoverCard(
                      article: article,
                      width: cardWidth,
                      coverHeight: coverHeight,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => context.push('/rubrique/$slug'),
              child: const Text('Voir toute la rubrique'),
            ),
          ],
        );
      },
    );
  }
}

/// Largeur d’une carte de rail : 2 cartes visibles + aperçu de la suivante.
({double width, double gap}) _railCardMetrics(BuildContext context) {
  const gap = 12.0;
  final available = MediaQuery.sizeOf(context).width - 40;
  return (width: (available - gap) / 2.2, gap: gap);
}

class _CoverRail extends StatelessWidget {
  const _CoverRail({required this.items});

  final List<ArticleCard> items;

  @override
  Widget build(BuildContext context) {
    final metrics = _railCardMetrics(context);
    final cardWidth = metrics.width;
    final gap = metrics.gap;
    final coverHeight = cardWidth * 4 / 3;

    return SizedBox(
      height: coverHeight + 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: items.length,
        separatorBuilder: (_, _) => SizedBox(width: gap),
        itemBuilder: (context, i) => _CoverCard(
          article: items[i],
          width: cardWidth,
          coverHeight: coverHeight,
        ),
      ),
    );
  }
}

class _RubriqueRail extends StatelessWidget {
  const _RubriqueRail({
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
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => context.push('/rubrique/$slug'),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
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
                      style: AppTheme.displayText(
                        size: 16,
                        weight: FontWeight.w800,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                  ),
                  Icon(
                    LucideIcons.chevronRight,
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.4),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _CoverRail(items: items),
        ],
      ),
    );
  }
}

class _CoverCard extends StatelessWidget {
  const _CoverCard({
    required this.article,
    this.width = 168,
    this.coverHeight = 112,
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

class _StuMagRail extends StatelessWidget {
  const _StuMagRail({required this.magazines});

  final List<MagazineCard> magazines;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final metrics = _railCardMetrics(context);
    final cardWidth = metrics.width;
    final gap = metrics.gap;
    final coverHeight = cardWidth * 4 / 3;

    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => context.go('/kiosque'),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Color(0xFFE1045C),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Stu Mag',
                      style: AppTheme.displayText(
                        size: 16,
                        weight: FontWeight.w800,
                        color: scheme.onSurface,
                      ),
                    ),
                  ),
                  Text(
                    'Tous les numéros',
                    style: AppTheme.sansText(
                      size: 13,
                      weight: FontWeight.w600,
                      color: scheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                  Icon(
                    LucideIcons.chevronRight,
                    color: scheme.onSurface.withValues(alpha: 0.4),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: coverHeight + 72,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: magazines.length,
              separatorBuilder: (_, _) => SizedBox(width: gap),
              itemBuilder: (context, i) => _MagIssueCard(
                magazine: magazines[i],
                width: cardWidth,
                coverHeight: coverHeight,
                latest: i == 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MagIssueCard extends StatelessWidget {
  const _MagIssueCard({
    required this.magazine,
    required this.width,
    required this.coverHeight,
    required this.latest,
  });

  final MagazineCard magazine;
  final double width;
  final double coverHeight;
  final bool latest;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final issue = _issueLabel(magazine.issueNumber);
    final free = magazine.accessType == 'FREE';

    return SizedBox(
      width: width,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.push('/magazine/${magazine.id}'),
          borderRadius: BorderRadius.circular(6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.navy.withValues(alpha: 0.16),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Stack(
                  children: [
                    Cover(
                      url: magazine.coverUrl,
                      height: coverHeight,
                      radius: 6,
                    ),
                    if (latest)
                      const Positioned(
                        top: 8,
                        right: 8,
                        child: _MagChip(
                          'Nouveau',
                          color: AppTheme.red,
                          ink: Colors.white,
                        ),
                      ),
                    if (issue != null)
                      Positioned(
                        left: 8,
                        bottom: 8,
                        child: _MagChip(
                          issue,
                          color: AppTheme.navy,
                          ink: Colors.white,
                        ),
                      ),
                    if (free)
                      const Positioned(
                        right: 8,
                        bottom: 8,
                        child: _MagChip(
                          'Gratuit',
                          color: AppTheme.gold,
                          ink: AppTheme.navy,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Text(
                magazine.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTheme.displayText(
                  size: 13,
                  weight: FontWeight.w700,
                  height: 1.25,
                  color: scheme.onSurface,
                ),
              ),
              if (magazine.dateLabel.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(
                  magazine.dateLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.sansText(
                    size: 11,
                    weight: FontWeight.w600,
                    color: scheme.onSurface.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MagChip extends StatelessWidget {
  const _MagChip(this.label, {required this.color, required this.ink});

  final String label;
  final Color color;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: AppTheme.sansText(
          size: 10,
          weight: FontWeight.w800,
          height: 1.1,
          letterSpacing: 0.2,
          color: ink,
        ),
      ),
    );
  }
}

String? _issueLabel(String? value) {
  if (value == null) return null;
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  if (trimmed.startsWith('#') || trimmed.toLowerCase().startsWith('n')) {
    return trimmed;
  }
  return '#$trimmed';
}

class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

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
      child: Column(
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
          LayoutBuilder(
            builder: (context, constraints) {
              final w = (constraints.maxWidth - 12) / 2.2;
              final h = w * 4 / 3;
              return SizedBox(
                height: h,
                child: Row(
                  children: [
                    Expanded(child: box(h: h, r: 16)),
                    const SizedBox(width: 12),
                    Expanded(child: box(h: h, r: 16)),
                  ],
                ),
              );
            },
          ),
        ],
      ),
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
