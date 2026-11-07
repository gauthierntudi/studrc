import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api.dart';
import '../../core/article_nav.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_icons.dart';
import '../../widgets/cover.dart';
import '../shorts/shorts_feed.dart';

/// Flux d’une rubrique ; slug vide = toutes les actualités.
final rubriqueProvider = FutureProvider.family<CategoryFeed, String>((
  ref,
  slug,
) {
  final api = ref.watch(apiClientProvider);
  if (slug.isEmpty) return api.feed(take: 30);
  return api.byCategory(slug, take: 30);
});

/// Nombre d’articles mis en avant dans le carrousel du haut.
const _heroCount = 5;

/// Écran plein d’une rubrique (ouvert depuis « Voir toute la rubrique »).
class RubriqueScreen extends StatelessWidget {
  const RubriqueScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context) {
    if (isShortRubrique(slug)) {
      return const ShortsScreen();
    }
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RubriqueFeedView(slug: slug),
      ),
    );
  }
}

/// Mise en page « rubrique » : en-tête daté, carrousel, Populaires, liste.
///
/// [embedded] : affichée dans un onglet (Accueil, Actualités), sous le
/// masthead — pas de bouton retour ni de logo.
class RubriqueFeedView extends ConsumerWidget {
  const RubriqueFeedView({
    super.key,
    required this.slug,
    this.embedded = false,
  });

  final String slug;
  final bool embedded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(rubriqueProvider(slug));
    final feed = async.valueOrNull;
    final label = slug.isEmpty
        ? 'Actualités'
        : capitalizeLabel(
            (feed?.label.isNotEmpty ?? false) ? feed!.label : _labelOf(slug),
          );
    final tone = AppTheme.toneColor(
      slug.isEmpty ? 'red' : (feed?.tone ?? _toneOf(slug)),
    );

    return RefreshIndicator(
      color: AppTheme.gold,
      onRefresh: () => ref.refresh(rubriqueProvider(slug).future),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: _Header(label: label, tone: tone, embedded: embedded),
          ),
          ...async.when(
            skipLoadingOnRefresh: true,
            loading: () => [
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              ),
            ],
            error: (e, _) => [
              SliverFillRemaining(
                hasScrollBody: false,
                child: _Message(
                  ref.read(apiClientProvider).apiError(e),
                  onRetry: () => ref.invalidate(rubriqueProvider(slug)),
                ),
              ),
            ],
            data: (feed) => _content(feed, tone),
          ),
        ],
      ),
    );
  }

  List<Widget> _content(CategoryFeed feed, Color tone) {
    if (feed.items.isEmpty) {
      return const [
        SliverFillRemaining(
          hasScrollBody: false,
          child: _Message('Pas encore d’articles.'),
        ),
      ];
    }
    // Petite rubrique : on garde des articles pour la liste du dessous.
    final heroCount = feed.items.length > _heroCount
        ? _heroCount
        : (feed.items.length / 2).ceil().clamp(1, 3);
    final hero = feed.items.take(heroCount).toList();
    final popular = (feed.mostRead.isNotEmpty ? feed.mostRead : feed.items)
        .take(5)
        .toList();
    final popularIds = popular.map((a) => a.id).toSet();
    final rest = feed.items
        .skip(heroCount)
        .where((a) => !popularIds.contains(a.id))
        .toList();
    // Toutes rubriques confondues : on affiche la rubrique de chaque article.
    final mixed = slug.isEmpty;

    return [
      SliverToBoxAdapter(child: _HeroCarousel(items: hero)),
      if (popular.isNotEmpty) ...[
        const SliverToBoxAdapter(child: _SectionTitle('Populaires')),
        _list(popular, tone, mixed),
      ],
      if (rest.isNotEmpty) ...[
        const SliverToBoxAdapter(child: _SectionTitle('Derniers articles')),
        _list(rest, tone, mixed),
      ],
      const SliverToBoxAdapter(child: SizedBox(height: 32)),
    ];
  }

  Widget _list(List<ArticleCard> items, Color tone, bool mixed) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      sliver: SliverList.separated(
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 6),
        itemBuilder: (context, i) => ArticleListRow(
          article: items[i],
          tone: tone,
          showCategory: mixed,
        ),
      ),
    );
  }
}

String _labelOf(String slug) {
  for (final r in kNewsRubriques) {
    if (r.slug == slug) return r.label;
  }
  return slug;
}

String _toneOf(String slug) {
  for (final r in kNewsRubriques) {
    if (r.slug == slug) return r.tone;
  }
  return 'blue';
}

// ------------------------------------------------------------------ en-tête

class _Header extends StatelessWidget {
  const _Header({
    required this.label,
    required this.tone,
    required this.embedded,
  });

  final String label;
  final Color tone;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final today = DateFormat('EEEE d MMMM', 'fr').format(DateTime.now());

    return Padding(
      padding: EdgeInsets.fromLTRB(16, embedded ? 18 : 8, 24, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!embedded) ...[
            IconButton(
              onPressed: () =>
                  context.canPop() ? context.pop() : context.go('/'),
              tooltip: 'Retour',
              icon: const Icon(AppIcons.arrowLeft, size: 22),
              style: IconButton.styleFrom(
                backgroundColor: scheme.onSurface.withValues(alpha: 0.06),
              ),
            ),
            const SizedBox(height: 14),
          ],
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        today.toUpperCase(),
                        style: AppTheme.sansText(
                          size: 12,
                          weight: FontWeight.w700,
                          height: 1.2,
                          letterSpacing: 0.6,
                          color: tone,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.displayText(
                          size: embedded ? 30 : 34,
                          weight: FontWeight.w800,
                          height: 1.1,
                          letterSpacing: -0.6,
                          color: scheme.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!embedded) ...[
                  const SizedBox(width: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.asset(
                      'assets/brand/studrc-mark.png',
                      width: 48,
                      height: 48,
                      fit: BoxFit.cover,
                      filterQuality: FilterQuality.high,
                      semanticLabel: 'STUDRC',
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 10),
      child: Text(
        title,
        style: AppTheme.displayText(
          size: 22,
          weight: FontWeight.w800,
          color: Theme.of(context).colorScheme.onSurface,
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message(this.text, {this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              text,
              textAlign: TextAlign.center,
              style: AppTheme.sansText(
                size: 14,
                color: Theme.of(context).colorScheme.onSurface.withValues(
                      alpha: 0.6,
                    ),
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 14),
              FilledButton(onPressed: onRetry, child: const Text('Réessayer')),
            ],
          ],
        ),
      ),
    );
  }
}

// -------------------------------------------------------------- carrousel

class _HeroCarousel extends StatefulWidget {
  const _HeroCarousel({required this.items});

  final List<ArticleCard> items;

  @override
  State<_HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<_HeroCarousel> {
  PageController? _controller;
  double _fraction = 0;

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final single = widget.items.length == 1;
        // Carte = largeur moins les marges ; on laisse dépasser la suivante.
        final cardWidth = single ? width - 48 : width - 72;
        final fraction = (cardWidth + 14) / width;
        if (_controller == null || (_fraction - fraction).abs() > 0.001) {
          _controller?.dispose();
          _controller = PageController(viewportFraction: fraction);
          _fraction = fraction;
        }
        final height = (cardWidth * 0.98).clamp(280.0, 420.0);

        return SizedBox(
          height: height,
          child: PageView.builder(
            controller: _controller,
            padEnds: false,
            itemCount: widget.items.length,
            itemBuilder: (context, i) => Padding(
              padding: EdgeInsets.only(left: i == 0 ? 24 : 0, right: 14),
              child: _HeroCard(article: widget.items[i]),
            ),
          ),
        );
      },
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.article});

  final ArticleCard article;

  @override
  Widget build(BuildContext context) {
    final video =
        isVideoRubrique(article.category, article.categoryLabel) ||
        article.hasReadyVideo;
    final ago = _agoLabel(article.publishedAt, article.dateLabel);

    return Material(
      color: const Color(kBrandNavy),
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      child: InkWell(
        onTap: () => openArticleCard(context, article),
        child: LayoutBuilder(
          builder: (context, c) => Stack(
            fit: StackFit.expand,
            children: [
              Cover(
                url: article.videoPosterUrl ?? article.coverUrl,
                play: video && article.durationClock.isEmpty,
                height: c.maxHeight,
                radius: 24,
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x33000000),
                      Color(0x00000000),
                      Color(0x14000000),
                      Color(0xD9000000),
                    ],
                    stops: [0, 0.22, 0.45, 1],
                  ),
                ),
              ),
              Positioned(
                top: 12,
                right: 12,
                child: _SaveButton(articleId: article.id),
              ),
              Positioned(
                left: 20,
                right: 20,
                bottom: 20,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      article.title,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.displayText(
                        size: 24,
                        weight: FontWeight.w800,
                        height: 1.2,
                        letterSpacing: -0.3,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        _SquareAvatar(
                          url: article.authorAvatarUrl,
                          name: article.authorName,
                          size: 38,
                          radius: 11,
                          background: Colors.white.withValues(alpha: 0.2),
                          foreground: Colors.white,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                article.authorName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTheme.sansText(
                                  size: 14,
                                  weight: FontWeight.w700,
                                  height: 1.25,
                                  color: Colors.white,
                                ),
                              ),
                              if (ago.isNotEmpty)
                                _IconMeta(
                                  icon: AppIcons.clock,
                                  text: ago,
                                  color: Colors.white.withValues(alpha: 0.78),
                                ),
                            ],
                          ),
                        ),
                      ],
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

/// Signet : même liste locale que la vue article.
class _SaveButton extends StatefulWidget {
  const _SaveButton({required this.articleId});

  final String articleId;

  @override
  State<_SaveButton> createState() => _SaveButtonState();
}

class _SaveButtonState extends State<_SaveButton> {
  static const _savedKey = 'saved.article.ids';
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final ids = prefs.getStringList(_savedKey) ?? const [];
    if (mounted) setState(() => _saved = ids.contains(widget.articleId));
  }

  Future<void> _toggle() async {
    final prefs = await SharedPreferences.getInstance();
    final ids = [...?prefs.getStringList(_savedKey)];
    if (_saved) {
      ids.remove(widget.articleId);
    } else if (!ids.contains(widget.articleId)) {
      ids.add(widget.articleId);
    }
    await prefs.setStringList(_savedKey, ids);
    if (!mounted) return;
    setState(() => _saved = !_saved);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(_saved ? 'Article enregistré' : 'Article retiré'),
          duration: const Duration(seconds: 2),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: _toggle,
      tooltip: _saved ? 'Retirer' : 'Enregistrer',
      icon: Icon(
        _saved ? AppIcons.bookmarkCheck : AppIcons.bookmark,
        size: 22,
        color: _saved ? AppTheme.gold : Colors.white,
        shadows: const [Shadow(color: Color(0x66000000), blurRadius: 10)],
      ),
    );
  }
}

// ------------------------------------------------------------------ liste

/// Ligne d’article : miniature carrée, surtitre, titre, date et vues.
class ArticleListRow extends StatelessWidget {
  const ArticleListRow({
    super.key,
    required this.article,
    required this.tone,
    this.showCategory = false,
  });

  final ArticleCard article;
  final Color tone;
  final bool showCategory;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final video =
        isVideoRubrique(article.category, article.categoryLabel) ||
        article.hasReadyVideo;
    final ago = _agoLabel(article.publishedAt, article.dateLabel);
    final muted = scheme.onSurface.withValues(alpha: 0.5);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => openArticleCard(context, article),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox.square(
                dimension: 92,
                child: Cover(
                  url: article.videoPosterUrl ?? article.coverUrl,
                  play: video,
                  height: 92,
                  radius: 16,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (showCategory && article.categoryLabel.isNotEmpty
                              ? capitalizeLabel(article.categoryLabel)
                              : article.authorName)
                          .toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.sansText(
                        size: 11,
                        weight: FontWeight.w700,
                        height: 1.2,
                        letterSpacing: 0.5,
                        color: showCategory
                            ? AppTheme.toneColor(articleToneOf(article))
                            : tone,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      article.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.displayText(
                        size: 16,
                        weight: FontWeight.w700,
                        height: 1.3,
                        color: scheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        if (ago.isNotEmpty) ...[
                          _IconMeta(icon: AppIcons.clock, text: ago, color: muted),
                          const SizedBox(width: 16),
                        ],
                        _IconMeta(
                          icon: AppIcons.eye,
                          text: _compactCount(article.viewCount),
                          color: muted,
                        ),
                      ],
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

// ------------------------------------------------------------------ outils

class _IconMeta extends StatelessWidget {
  const _IconMeta({
    required this.icon,
    required this.text,
    required this.color,
  });

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 5),
        Text(
          text,
          style: AppTheme.sansText(size: 12, height: 1.3, color: color),
        ),
      ],
    );
  }
}

class _SquareAvatar extends StatelessWidget {
  const _SquareAvatar({
    required this.url,
    required this.name,
    required this.size,
    required this.radius,
    required this.background,
    required this.foreground,
  });

  final String? url;
  final String name;
  final double size;
  final double radius;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isEmpty
        ? null
        : name.trim().characters.first.toUpperCase();
    final fallback = Center(
      child: initial == null
          ? Icon(AppIcons.userRound, size: size * 0.45, color: foreground)
          : Text(
              initial,
              style: AppTheme.displayText(
                size: size * 0.42,
                weight: FontWeight.w800,
                color: foreground,
              ),
            ),
    );
    final hasUrl = url != null && url!.isNotEmpty;

    return Material(
      color: background,
      borderRadius: BorderRadius.circular(radius),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        child: SizedBox.square(
          dimension: size,
          child: hasUrl
              ? CachedNetworkImage(
                  imageUrl: url!,
                  fit: BoxFit.cover,
                  errorWidget: (_, _, _) => fallback,
                  placeholder: (_, _) => fallback,
                )
              : fallback,
        ),
      ),
    );
  }
}

/// « il y a 2 h », « il y a 3 j », puis la date de l’article.
String _agoLabel(String? publishedAt, String fallback) {
  final parsed = publishedAt == null ? null : DateTime.tryParse(publishedAt);
  if (parsed == null) return fallback;
  final when = parsed.toLocal();
  final diff = DateTime.now().difference(when);
  if (diff.inMinutes < 1) return 'à l’instant';
  if (diff.inMinutes < 60) return 'il y a ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'il y a ${diff.inHours} h';
  if (diff.inDays < 7) return 'il y a ${diff.inDays} j';
  return DateFormat('d MMM y', 'fr').format(when);
}

String _compactCount(int n) {
  if (n >= 1000000) {
    return '${(n / 1000000).toStringAsFixed(1).replaceAll('.0', '')} M';
  }
  if (n >= 1000) {
    return '${(n / 1000).toStringAsFixed(1).replaceAll('.0', '')} k';
  }
  return '$n';
}
