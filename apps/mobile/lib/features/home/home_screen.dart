import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/article_tile.dart';
import '../../widgets/cover.dart';
import '../../widgets/studrc_logo.dart';

final homeProvider = FutureProvider((ref) async {
  final api = ref.watch(apiClientProvider);
  final feed = await api.home();
  MagazineCard? latest;
  try {
    latest = await api.latestMagazine();
  } catch (_) {}
  return (feed: feed, latest: latest);
});

List<ArticleCard> _unique(Iterable<ArticleCard> items) {
  final seen = <String>{};
  return [for (final a in items) if (seen.add(a.id)) a];
}

final _tabLabels = <String>[
  'À la une',
  ...kRubriques.map((r) => r.label),
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
    final dark = Theme.of(context).brightness == Brightness.dark;
    final line = dark
        ? Colors.white.withValues(alpha: 0.08)
        : const Color(0xFFE6E6E6);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            _Masthead(
              onSearch: () => context.push('/recherche'),
              onNotify: () => context.push(
                user == null ? '/connexion' : '/notifications',
              ),
            ),
            _SectionTabs(controller: _tabs, line: line),
            Expanded(
              child: async.when(
                loading: () => const _HomeSkeleton(),
                error: (e, _) => _Retry(
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
                    children: [
                      _UnePage(
                        une: une,
                        feed: feed,
                        latest: data.latest,
                        onRefresh: () async => ref.refresh(homeProvider.future),
                      ),
                      for (var i = 0; i < kRubriques.length; i++)
                        _RubriquePage(
                          items: byRubrique[i],
                          slug: kRubriques[i].slug,
                          onRefresh: () async =>
                              ref.refresh(homeProvider.future),
                        ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Masthead extends StatelessWidget {
  const _Masthead({required this.onSearch, required this.onNotify});

  final VoidCallback onSearch;
  final VoidCallback onNotify;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = dark ? Colors.white : AppTheme.navy;
    return SizedBox(
      height: 52,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Row(
          children: [
            SizedBox(
              width: 48,
              child: _HeaderIcon(
                icon: Icons.search,
                tooltip: 'Rechercher',
                color: ink,
                onTap: onSearch,
              ),
            ),
            Expanded(
              child: Center(
                child: StudrcLogo(height: 26, color: ink),
              ),
            ),
            SizedBox(
              width: 48,
              child: _HeaderIcon(
                icon: Icons.notifications_none_rounded,
                tooltip: 'Notifications',
                color: ink,
                onTap: onNotify,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon({
    required this.icon,
    required this.tooltip,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: tooltip,
      icon: Icon(icon, size: 24),
      color: color,
      style: IconButton.styleFrom(
        minimumSize: const Size(44, 44),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}

class _SectionTabs extends StatelessWidget {
  const _SectionTabs({required this.controller, required this.line});

  final TabController controller;
  final Color line;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final selected = dark ? Colors.white : AppTheme.navy;
    final idle = selected.withValues(alpha: 0.42);

    return Material(
      color: Colors.transparent,
      child: TabBar(
        controller: controller,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        labelPadding: const EdgeInsets.symmetric(horizontal: 14),
        labelColor: selected,
        unselectedLabelColor: idle,
        labelStyle: AppTheme.displayText(
          size: 13,
          weight: FontWeight.w700,
          height: 1.1,
          letterSpacing: 0.15,
        ),
        unselectedLabelStyle: AppTheme.sansText(
          size: 13,
          weight: FontWeight.w600,
          height: 1.1,
          letterSpacing: 0.1,
        ),
        indicator: const UnderlineTabIndicator(
          borderSide: BorderSide(color: AppTheme.gold, width: 2.5),
        ),
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: line,
        dividerHeight: 0.5,
        splashFactory: NoSplash.splashFactory,
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        tabs: [for (final label in _tabLabels) Tab(text: label, height: 40)],
      ),
    );
  }
}

class _UnePage extends StatelessWidget {
  const _UnePage({
    required this.une,
    required this.feed,
    required this.latest,
    required this.onRefresh,
  });

  final List<ArticleCard> une;
  final HomeFeed feed;
  final MagazineCard? latest;
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
          ...rails.where((r) => r.items.isNotEmpty).map(
                (r) => _RubriqueRail(
                  label: r.label,
                  slug: r.slug,
                  tone: r.tone,
                  items: r.items.take(10).toList(),
                ),
              ),
          if (latest != null) ...[
            const SizedBox(height: 8),
            _KiosqueTeaser(magazine: latest!),
          ],
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
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
        children: [
          FeaturedCard(article: items.first),
          const SizedBox(height: 8),
          ...items.skip(1).map(
                (a) => ArticleTile(article: a, showMeta: false),
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

class _CoverRail extends StatelessWidget {
  const _CoverRail({required this.items});

  final List<ArticleCard> items;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 188,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) => _CoverCard(article: items[i]),
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
                    Icons.chevron_right,
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.4),
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
  const _CoverCard({required this.article});

  final ArticleCard article;

  @override
  Widget build(BuildContext context) {
    final play = isVideoRubrique(article.category, article.categoryLabel);
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: 168,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () =>
              context.push('/article/${Uri.encodeComponent(article.slug)}'),
          borderRadius: BorderRadius.circular(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Cover(
                url: article.coverUrl,
                play: play,
                height: 112,
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

class _KiosqueTeaser extends StatelessWidget {
  const _KiosqueTeaser({required this.magazine});
  final MagazineCard magazine;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: isDark ? scheme.surface : Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: () => context.go('/kiosque'),
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: scheme.outlineVariant.withValues(alpha: 0.5),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                SizedBox(
                  width: 88,
                  height: 118,
                  child: Cover(url: magazine.coverUrl, radius: 12),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    magazine.title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.displayText(
                      size: 16,
                      weight: FontWeight.w800,
                      height: 1.25,
                    ),
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  color: scheme.onSurface.withValues(alpha: 0.4),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
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
          box(h: 260, r: 22),
          const SizedBox(height: 20),
          SizedBox(
            height: 112,
            child: Row(
              children: [
                Expanded(child: box(h: 112, r: 16)),
                const SizedBox(width: 12),
                Expanded(child: box(h: 112, r: 16)),
              ],
            ),
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
