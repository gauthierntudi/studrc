import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:studrc/widgets/app_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api.dart';
import '../../core/article_nav.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../core/now_playing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/cover.dart';
import '../shorts/shorts_feed.dart';

final articleProvider = FutureProvider.family((ref, String slug) {
  return ref.watch(apiClientProvider).article(slug);
});

final relatedProvider = FutureProvider.family((ref, String slug) {
  return ref.watch(apiClientProvider).related(slug);
});

class ArticleScreen extends ConsumerWidget {
  const ArticleScreen({super.key, required this.slug, this.previewTone});

  final String slug;
  final String? previewTone;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(articleProvider(slug));
    final washTone =
        previewTone ??
        rememberedArticleTone(slug) ??
        (async.valueOrNull?.categoryTone) ??
        toneFromCategory(
          async.valueOrNull?.category,
          async.valueOrNull?.categoryLabel,
        );
    return async.when(
      loading: () => _ArticleLoading(tone: washTone),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: Center(child: Text(ref.read(apiClientProvider).apiError(e))),
      ),
      data: (article) {
        if (isShortRubrique(article.category, article.categoryLabel)) {
          return ShortsScreen(initialSlug: article.slug);
        }
        return article.hasReadyVideo
            ? _VideoWatchView(article: article)
            : _ArticleView(article: article);
      },
    );
  }
}

class _ArticleLoading extends StatelessWidget {
  const _ArticleLoading({required this.tone});

  final String tone;

  @override
  Widget build(BuildContext context) {
    final wash = AppTheme.toneColor(tone);
    final ink = wash.computeLuminance() > 0.45 ? AppTheme.navy : Colors.white;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: wash.computeLuminance() > 0.45
          ? SystemUiOverlayStyle.dark
          : SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: wash,
        body: Center(child: CircularProgressIndicator(color: ink)),
      ),
    );
  }
}

class _VideoWatchView extends ConsumerStatefulWidget {
  const _VideoWatchView({required this.article});

  final ArticleDetail article;

  @override
  ConsumerState<_VideoWatchView> createState() => _VideoWatchViewState();
}

class _VideoWatchViewState extends ConsumerState<_VideoWatchView> {
  static const _savedKey = 'saved.article.ids';

  bool _collapsing = false;
  bool _openingRelated = false;
  bool _saved = false;
  double _pull = 0;
  Offset? _pointerStart;
  bool _pulling = false;
  late final NowPlayingController _nowPlaying;

  @override
  void initState() {
    super.initState();
    rememberArticleTone(
      widget.article.slug,
      widget.article.categoryTone ??
          toneFromCategory(
            widget.article.category,
            widget.article.categoryLabel,
          ),
    );
    _nowPlaying = ref.read(nowPlayingProvider.notifier);
    _nowPlaying.start(widget.article);
    _restoreSaved();
  }

  void _openRelated(ArticleCard article) {
    _openingRelated = true;
    ref.read(nowPlayingProvider.notifier).stop();
    openArticleCard(context, article, replace: true);
  }

  Future<void> _restoreSaved() async {
    final prefs = await SharedPreferences.getInstance();
    final ids = prefs.getStringList(_savedKey) ?? const [];
    if (mounted) setState(() => _saved = ids.contains(widget.article.id));
  }

  Future<void> _toggleSaved() async {
    final prefs = await SharedPreferences.getInstance();
    final ids = [...?prefs.getStringList(_savedKey)];
    if (_saved) {
      ids.remove(widget.article.id);
    } else {
      ids.add(widget.article.id);
    }
    await prefs.setStringList(_savedKey, ids);
    HapticFeedback.lightImpact();
    if (mounted) setState(() => _saved = !_saved);
  }

  Future<void> _share() {
    final url = '$kSiteUrl/article/${Uri.encodeComponent(widget.article.slug)}';
    return SharePlus.instance.share(
      ShareParams(
        text: '${widget.article.title}\n$url',
        subject: widget.article.title,
        title: widget.article.title,
      ),
    );
  }

  void _openDescription() {
    final article = widget.article;
    final hasExcerpt =
        article.excerpt != null && article.excerpt!.trim().isNotEmpty;
    final hasDesc = _hasBody(article);
    if (!hasExcerpt && !hasDesc) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _VideoDescriptionSheet(article: article),
    );
  }

  @override
  void didUpdateWidget(covariant _VideoWatchView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.article.slug != widget.article.slug) {
      ref.read(nowPlayingProvider.notifier).start(widget.article);
    }
  }

  void _collapse() {
    if (_collapsing || !mounted) return;
    _collapsing = true;
    HapticFeedback.lightImpact();
    ref.read(nowPlayingProvider.notifier).minimize();
    // Laisser une frame pour que la [GlobalKey] glisse vers la mini barre
    // avant de démonter la page (sinon texture iOS noire + son sans image).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/');
      }
    });
  }

  void _onPointerDown(PointerDownEvent event) {
    _pointerStart = event.localPosition;
    _pulling = false;
  }

  void _onPointerMove(PointerMoveEvent event, double areaHeight) {
    final start = _pointerStart;
    if (start == null || _collapsing) return;
    if (start.dy > areaHeight - 48) return;
    final total = event.localPosition - start;
    if (!_pulling) {
      if (total.dy > 14 && total.dy.abs() > total.dx.abs()) {
        _pulling = true;
      } else {
        return;
      }
    }
    setState(() => _pull = total.dy.clamp(0, 240));
  }

  void _onPointerEnd() {
    if (_collapsing) return;
    if (_pulling && _pull > 80) {
      _collapse();
      return;
    }
    if (_pull != 0 || _pulling) {
      setState(() {
        _pull = 0;
        _pulling = false;
        _pointerStart = null;
      });
    } else {
      _pointerStart = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<NowPlaying?>(nowPlayingProvider, (prev, next) {
      if (_collapsing || _openingRelated || !mounted) return;
      if (next == null) {
        _collapse();
        return;
      }
      if (next.slug == widget.article.slug && next.minimized) {
        _collapse();
      }
    });
    final article = widget.article;
    final related = ref.watch(relatedProvider(article.slug));
    final date = _videoDateLabel(article.publishedAt);
    final scheme = Theme.of(context).colorScheme;
    final hasExcerpt =
        article.excerpt != null && article.excerpt!.trim().isNotEmpty;
    final hasDesc = _hasBody(article);
    final canExpand = hasExcerpt || hasDesc;
    final session = ref.watch(nowPlayingProvider);
    final fade = (1 - (_pull / 180)).clamp(0.0, 1.0);
    final pullAreaHeight = MediaQuery.sizeOf(context).width * 9 / 16;
    final topInset = MediaQuery.paddingOf(context).top;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        final live = ref.read(nowPlayingProvider);
        if (live?.fullscreen == true) {
          ref.read(nowPlayingProvider.notifier).toggleFullscreen();
          return;
        }
        _collapse();
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
        child: Scaffold(
          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
          body: Column(
            children: [
              Transform.translate(
                offset: Offset(0, _pull * 0.45),
                child: Listener(
                  onPointerDown: _onPointerDown,
                  onPointerMove: (e) => _onPointerMove(e, pullAreaHeight),
                  onPointerUp: (_) => _onPointerEnd(),
                  onPointerCancel: (_) => _onPointerEnd(),
                  child: ColoredBox(
                    color: Colors.black,
                    child: Stack(
                      children: [
                        AspectRatio(
                          aspectRatio: 16 / 9,
                          child: _MainPlayerPoster(
                            url: article.videoPosterUrl ?? article.coverUrl,
                          ),
                        ),
                        if (session == null ||
                            session.slug != article.slug ||
                            session.minimized)
                          Positioned(
                            top: topInset > 0 ? topInset - 2 : 4,
                            left: 4,
                            child: IconButton(
                              onPressed: _collapse,
                              tooltip: 'Réduire',
                              style: IconButton.styleFrom(
                                foregroundColor: Colors.white,
                                backgroundColor: Colors.black.withValues(
                                  alpha: 0.35,
                                ),
                                minimumSize: const Size(44, 44),
                              ),
                              icon: const Icon(AppIcons.chevronDown),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: Opacity(
                  opacity: fade,
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
                      InkWell(
                        onTap: canExpand ? _openDescription : null,
                        child: Semantics(
                          button: canExpand,
                          label: canExpand ? 'Afficher la description' : null,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  article.title,
                                  style: AppTheme.displayText(
                                    size: 22,
                                    weight: FontWeight.w800,
                                    height: 1.2,
                                  ),
                                ),
                              ),
                              if (canExpand)
                                Padding(
                                  padding: const EdgeInsets.only(
                                    left: 8,
                                    top: 4,
                                  ),
                                  child: Icon(
                                    AppIcons.chevronDown,
                                    color: scheme.onSurface.withValues(
                                      alpha: 0.55,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: _ArticleAuthor(
                              name: article.authorName,
                              title: [
                                if ((article.authorTitle ?? '')
                                    .trim()
                                    .isNotEmpty)
                                  article.authorTitle!.trim(),
                                if (date != null) date,
                              ].join(' · '),
                              avatarUrl: article.authorAvatarUrl,
                            ),
                          ),
                          IconButton(
                            tooltip: _saved ? 'Retirer' : 'Enregistrer',
                            onPressed: _toggleSaved,
                            visualDensity: VisualDensity.compact,
                            icon: Icon(
                              _saved
                                  ? AppIcons.bookmarkCheck
                                  : AppIcons.bookmark,
                              color: _saved
                                  ? AppTheme.gold
                                  : scheme.onSurface.withValues(alpha: 0.7),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Partager',
                            onPressed: _share,
                            visualDensity: VisualDensity.compact,
                            icon: Icon(
                              AppIcons.share2,
                              color: scheme.onSurface.withValues(alpha: 0.7),
                            ),
                          ),
                        ],
                      ),
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
                                ...videos.map(
                                  (a) => _RelatedVideoTile(
                                    article: a,
                                    onOpen: _openRelated,
                                  ),
                                ),
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
                                _RelatedArticleRail(
                                  articles: articles,
                                  onOpen: _openRelated,
                                ),
                              ],
                            ],
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ArticleView extends ConsumerStatefulWidget {
  const _ArticleView({required this.article});

  final ArticleDetail article;

  @override
  ConsumerState<_ArticleView> createState() => _ArticleViewState();
}

class _ArticleViewState extends ConsumerState<_ArticleView> {
  static const _savedKey = 'saved.article.ids';

  final _scroll = ScrollController();
  bool _compactChrome = false;
  bool _saved = false;

  ArticleDetail get article => widget.article;

  String get _webUrl =>
      '$kSiteUrl/article/${Uri.encodeComponent(article.slug)}';

  @override
  void initState() {
    super.initState();
    rememberArticleTone(
      widget.article.slug,
      widget.article.categoryTone ??
          toneFromCategory(
            widget.article.category,
            widget.article.categoryLabel,
          ),
    );
    _scroll.addListener(_onScroll);
    _restoreSaved();
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    final threshold = MediaQuery.sizeOf(context).height * 0.38;
    final compact = _scroll.offset > threshold;
    if (compact != _compactChrome) {
      setState(() => _compactChrome = compact);
    }
  }

  Future<void> _restoreSaved() async {
    final prefs = await SharedPreferences.getInstance();
    final ids = prefs.getStringList(_savedKey) ?? const [];
    if (mounted) setState(() => _saved = ids.contains(article.id));
  }

  Future<void> _toggleSaved() async {
    final prefs = await SharedPreferences.getInstance();
    final ids = [...?prefs.getStringList(_savedKey)];
    if (_saved) {
      ids.remove(article.id);
    } else {
      ids.add(article.id);
    }
    await prefs.setStringList(_savedKey, ids);
    HapticFeedback.lightImpact();
    if (mounted) setState(() => _saved = !_saved);
  }

  Future<void> _share() {
    return SharePlus.instance.share(
      ShareParams(
        text: '${article.title}\n$_webUrl',
        subject: article.title,
        title: article.title,
      ),
    );
  }

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final related = ref.watch(relatedProvider(article.slug));
    final scheme = Theme.of(context).colorScheme;
    final surface = Theme.of(context).scaffoldBackgroundColor;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final tone = AppTheme.toneColor(
      article.categoryTone ??
          toneFromCategory(article.category, article.categoryLabel),
    );
    final heroHeight = size.height * 0.46;
    const overlap = 34.0;
    final excerpt = article.excerpt?.trim() ?? '';
    final rubrique = _rubriqueLabel(article);
    final muted = scheme.onSurface.withValues(alpha: 0.55);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: _compactChrome && !dark
          ? SystemUiOverlayStyle.dark
          : SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: surface,
        body: Stack(
          children: [
            CustomScrollView(
              controller: _scroll,
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              slivers: [
                SliverToBoxAdapter(
                  child: Stack(
                    children: [
                      Positioned(
                        top: 0,
                        left: 0,
                        right: 0,
                        height: heroHeight,
                        child: _ArticleCover(url: article.coverUrl, tone: tone),
                      ),
                      Padding(
                        padding: EdgeInsets.only(top: heroHeight - overlap),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: size.height - heroHeight + overlap,
                          ),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: surface,
                              borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(overlap),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    24,
                                    30,
                                    24,
                                    0,
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      if (rubrique.isNotEmpty) ...[
                                        Text(
                                          rubrique.toUpperCase(),
                                          style: AppTheme.sansText(
                                            size: 13,
                                            weight: FontWeight.w600,
                                            height: 1.2,
                                            letterSpacing: 0.4,
                                            color: tone,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                      ],
                                      Text(
                                        article.title,
                                        style: AppTheme.displayText(
                                          size: 26,
                                          weight: FontWeight.w700,
                                          height: 1.25,
                                          letterSpacing: -0.2,
                                          color: scheme.onSurface,
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                      _ArticleMeta(
                                        ago: _agoLabel(article.publishedAt),
                                        views: article.viewCount,
                                        color: muted,
                                        saved: _saved,
                                        onShare: _share,
                                      ),
                                      const SizedBox(height: 18),
                                      _ArticleAuthor(
                                        name: article.authorName,
                                        title: article.authorTitle,
                                        avatarUrl: article.authorAvatarUrl,
                                      ),
                                      const SizedBox(height: 22),
                                      if (excerpt.isNotEmpty) ...[
                                        Text(
                                          excerpt,
                                          style: AppTheme.sansText(
                                            size: 16,
                                            height: 1.75,
                                            color: muted,
                                          ),
                                        ),
                                        const SizedBox(height: 18),
                                      ],
                                      _ArticleHtml(article: article),
                                    ],
                                  ),
                                ),
                                related.when(
                                  loading: () => const SizedBox(height: 48),
                                  error: (_, _) => const SizedBox(height: 48),
                                  data: (items) {
                                    if (items.isEmpty) {
                                      return const SizedBox(height: 48);
                                    }
                                    return Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const SizedBox(height: 28),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 24,
                                          ),
                                          child: Text(
                                            'À lire aussi',
                                            style: AppTheme.displayText(
                                              size: 18,
                                              weight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        _RelatedArticleRail(
                                          articles: items,
                                          padding: const EdgeInsets.fromLTRB(
                                            24,
                                            0,
                                            24,
                                            0,
                                          ),
                                        ),
                                        const SizedBox(height: 48),
                                      ],
                                    );
                                  },
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                decoration: BoxDecoration(
                  color: _compactChrome ? surface : Colors.transparent,
                  boxShadow: _compactChrome
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.06),
                            blurRadius: 10,
                          ),
                        ]
                      : const [],
                ),
                child: SafeArea(
                  bottom: false,
                  child: SizedBox(
                    height: 52,
                    child: Row(
                      children: [
                        const SizedBox(width: 8),
                        _HeroIconButton(
                          icon: AppIcons.chevronLeft,
                          tooltip: 'Retour',
                          onPressed: _back,
                          color: _compactChrome
                              ? scheme.onSurface
                              : Colors.white,
                          shadow: !_compactChrome,
                        ),
                        Expanded(
                          child: AnimatedOpacity(
                            opacity: _compactChrome ? 1 : 0,
                            duration: const Duration(milliseconds: 160),
                            child: Text(
                              article.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTheme.displayText(
                                size: 16,
                                weight: FontWeight.w700,
                                color: scheme.onSurface,
                              ),
                            ),
                          ),
                        ),
                        _HeroIconButton(
                          icon: _saved
                              ? AppIcons.bookmarkCheck
                              : AppIcons.bookmark,
                          tooltip: _saved ? 'Retirer' : 'Enregistrer',
                          onPressed: _toggleSaved,
                          color: _compactChrome
                              ? (_saved ? AppTheme.red : scheme.onSurface)
                              : Colors.white,
                          shadow: !_compactChrome,
                        ),
                        const SizedBox(width: 8),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _rubriqueLabel(ArticleDetail article) {
  final label = article.categoryLabel?.trim() ?? '';
  if (label.isNotEmpty) return label;
  final slug = article.category?.trim().toLowerCase() ?? '';
  if (slug.isEmpty) return '';
  for (final r in kNewsRubriques) {
    if (r.slug == slug) return r.label;
  }
  return capitalizeLabel(slug);
}

const _iconShadow = [Shadow(color: Color(0x66000000), blurRadius: 10)];

/// « il y a 2 h », « il y a 3 j », puis date complète.
String _agoLabel(String? publishedAt) {
  final parsed = publishedAt == null ? null : DateTime.tryParse(publishedAt);
  if (parsed == null) return '';
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

class _ArticleCover extends StatelessWidget {
  const _ArticleCover({required this.url, required this.tone});

  final String? url;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final src = url;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (src == null || src.isEmpty)
          ColoredBox(color: tone)
        else
          CachedNetworkImage(
            imageUrl: src,
            fit: BoxFit.cover,
            placeholder: (_, _) =>
                ColoredBox(color: tone.withValues(alpha: 0.4)),
            errorWidget: (_, _, _) => ColoredBox(color: tone),
          ),
        // Lisibilité des icônes du haut
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              stops: [0, 0.32],
              colors: [Color(0x59000000), Color(0x00000000)],
            ),
          ),
        ),
      ],
    );
  }
}

class _ArticleMeta extends StatelessWidget {
  const _ArticleMeta({
    required this.ago,
    required this.views,
    required this.color,
    required this.saved,
    required this.onShare,
  });

  final String ago;
  final int views;
  final Color color;
  final bool saved;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final style = AppTheme.sansText(size: 13, height: 1.2, color: color);
    return Row(
      children: [
        if (ago.isNotEmpty) ...[
          Icon(AppIcons.clock, size: 15, color: color),
          const SizedBox(width: 5),
          Text(ago, style: style),
          const SizedBox(width: 22),
        ],
        Icon(AppIcons.eye, size: 15, color: color),
        const SizedBox(width: 5),
        Text(_compactCount(views), style: style),
        const Spacer(),
        InkResponse(
          onTap: onShare,
          radius: 20,
          child: Icon(AppIcons.share2, size: 18, color: color),
        ),
      ],
    );
  }
}

class _ArticleAuthor extends StatelessWidget {
  const _ArticleAuthor({
    required this.name,
    required this.title,
    required this.avatarUrl,
  });

  final String? name;
  final String? title;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final label = (name?.trim().isNotEmpty ?? false) ? name!.trim() : 'STUDRC';
    final initials = label
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p[0].toUpperCase())
        .join();
    final url = avatarUrl;
    final role = title?.trim();

    return Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(9),
          child: SizedBox(
            width: 34,
            height: 34,
            child: url != null && url.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: url,
                    fit: BoxFit.cover,
                    errorWidget: (_, _, _) => _Initials(initials),
                  )
                : _Initials(initials),
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTheme.sansText(
                  size: 15,
                  weight: FontWeight.w600,
                  height: 1.2,
                  color: scheme.onSurface,
                ),
              ),
              if (role != null && role.isNotEmpty)
                Text(
                  role,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.sansText(
                    size: 12,
                    height: 1.3,
                    color: scheme.onSurface.withValues(alpha: 0.5),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Initials extends StatelessWidget {
  const _Initials(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppTheme.blue,
      child: Center(
        child: Text(
          text,
          style: AppTheme.sansText(
            size: 13,
            weight: FontWeight.w700,
            height: 1,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

class _HeroIconButton extends StatelessWidget {
  const _HeroIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.color = Colors.white,
    this.shadow = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final Color color;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      tooltip: tooltip,
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
      icon: Icon(
        icon,
        color: color,
        size: 24,
        shadows: shadow ? _iconShadow : null,
      ),
    );
  }
}

class _RelatedVideoTile extends StatelessWidget {
  const _RelatedVideoTile({required this.article, this.onOpen});

  final ArticleCard article;
  final void Function(ArticleCard article)? onOpen;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          if (onOpen != null) {
            onOpen!(article);
          } else {
            openArticleCard(context, article, replace: true);
          }
        },
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
                  duration: article.durationClock,
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
                    if (article.categoryLabel.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        capitalizeLabel(article.categoryLabel),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.sansText(
                          size: 12,
                          color: scheme.onSurface.withValues(alpha: 0.55),
                        ),
                      ),
                    ],
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
  const _RelatedArticleRail({
    required this.articles,
    this.padding = EdgeInsets.zero,
    this.onOpen,
  });

  final List<ArticleCard> articles;
  final EdgeInsets padding;
  final void Function(ArticleCard article)? onOpen;

  @override
  Widget build(BuildContext context) {
    const gap = 12.0;
    final padH = padding.horizontal;
    final available = MediaQuery.sizeOf(context).width - (padH > 0 ? padH : 32);
    final cardWidth = (available - gap) / 2.2;
    final coverHeight = cardWidth * 4 / 3;

    return SizedBox(
      height: coverHeight + 68,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
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
              onOpen: onOpen,
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
    this.onOpen,
  });

  final ArticleCard article;
  final double coverHeight;
  final void Function(ArticleCard article)? onOpen;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          if (onOpen != null) {
            onOpen!(article);
          } else {
            openArticleCard(context, article);
          }
        },
        borderRadius: BorderRadius.circular(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Cover(
              url: article.videoPosterUrl ?? article.coverUrl,
              duration: article.durationClock,
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

/// Retire les couleurs/fonds collés depuis un éditeur (ex. texte blanc
/// `<font color="#ffffff">`) pour que le corps suive le thème de l'app.
String _cleanHtml(String html) {
  return html
      .replaceAll(
        RegExp(
          r'''\s(color|bgcolor)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)''',
          caseSensitive: false,
        ),
        '',
      )
      .replaceAllMapped(
        RegExp(r'''style\s*=\s*"([^"]*)"''', caseSensitive: false),
        (m) {
          final kept = m[1]!
              .split(';')
              .where((d) {
                final prop = d.split(':').first.trim().toLowerCase();
                return prop.isNotEmpty &&
                    prop != 'color' &&
                    prop != 'background' &&
                    prop != 'background-color' &&
                    prop != 'font-family' &&
                    prop != 'font-size';
              })
              .join(';');
          return 'style="$kept"';
        },
      );
}

TextStyle _bodyStyle(BuildContext context) => AppTheme.sansText(
  size: 16,
  height: 1.7,
  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.82),
);

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
                    _cleanHtml(b.content),
                    textStyle: _bodyStyle(context),
                  ),
                ],
              ),
            ),
        ],
      );
    }
    if (article.content.isNotEmpty) {
      return HtmlWidget(
        _cleanHtml(article.content),
        textStyle: _bodyStyle(context),
      );
    }
    return const SizedBox.shrink();
  }
}

class _VideoDescriptionSheet extends StatefulWidget {
  const _VideoDescriptionSheet({required this.article});

  final ArticleDetail article;

  @override
  State<_VideoDescriptionSheet> createState() => _VideoDescriptionSheetState();
}

class _VideoDescriptionSheetState extends State<_VideoDescriptionSheet> {
  final _measureKey = GlobalKey();
  double _initial = 0.36;
  double _max = 0.92;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
  }

  void _measure() {
    if (!mounted) return;
    final box = _measureKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) {
      setState(() {
        _initial = 0.42;
        _max = 0.92;
        _ready = true;
      });
      return;
    }
    final screen = MediaQuery.sizeOf(context).height;
    final fraction = (box.size.height / screen).clamp(0.22, 0.92);
    final overflows = fraction > 0.55;
    setState(() {
      _initial = overflows ? 0.52 : fraction;
      _max = overflows ? 0.92 : fraction;
      _ready = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final article = widget.article;
    final hasExcerpt =
        article.excerpt != null && article.excerpt!.trim().isNotEmpty;
    final bottom = MediaQuery.paddingOf(context).bottom;

    Widget body({ScrollController? scroll}) {
      return ListView(
        key: scroll == null ? _measureKey : null,
        controller: scroll,
        shrinkWrap: scroll == null,
        physics: scroll == null ? const NeverScrollableScrollPhysics() : null,
        padding: EdgeInsets.fromLTRB(20, 10, 20, 20 + bottom),
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: scheme.onSurface.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            article.title,
            style: AppTheme.displayText(
              size: 20,
              weight: FontWeight.w800,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 16),
          if (hasExcerpt) ...[
            Text(
              article.excerpt!,
              style: AppTheme.sansText(
                size: 15,
                height: 1.5,
                color: scheme.onSurface.withValues(alpha: 0.82),
              ),
            ),
            if (_hasBody(article)) const SizedBox(height: 16),
          ],
          if (_hasBody(article)) _ArticleHtml(article: article),
        ],
      );
    }

    if (!_ready) {
      return Align(
        alignment: Alignment.bottomCenter,
        child: Opacity(opacity: 0, child: body()),
      );
    }

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: _initial,
      minChildSize: (_initial - 0.08).clamp(0.18, _initial),
      maxChildSize: _max,
      builder: (context, scroll) {
        return Material(
          color: scheme.surface,
          elevation: 0,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
          clipBehavior: Clip.antiAlias,
          child: body(scroll: scroll),
        );
      },
    );
  }
}

bool _hasBody(ArticleDetail article) {
  return article.blocks.isNotEmpty || article.content.isNotEmpty;
}

/// Date relative pour les vidéos : `2j`, `3 semaines`, `1 mois`, puis date complète après 30 jours.
String? _videoDateLabel(String? publishedAt) {
  if (publishedAt == null) return null;
  final parsed = DateTime.tryParse(publishedAt);
  if (parsed == null) return null;
  final posted = parsed.toLocal();
  final now = DateTime.now();
  final days = DateTime(
    now.year,
    now.month,
    now.day,
  ).difference(DateTime(posted.year, posted.month, posted.day)).inDays;
  if (days <= 0) return 'Aujourd’hui';
  if (days < 7) return '${days}j';
  if (days < 30) {
    final weeks = days ~/ 7;
    return weeks <= 1 ? '1 semaine' : '$weeks semaines';
  }
  return DateFormat('d MMMM y', 'fr').format(posted);
}

class _MainPlayerPoster extends StatelessWidget {
  const _MainPlayerPoster({this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) {
      return const ColoredBox(color: Colors.black);
    }
    return ColoredBox(
      color: Colors.black,
      child: CachedNetworkImage(
        imageUrl: url!,
        fit: BoxFit.cover,
        fadeInDuration: Duration.zero,
        fadeOutDuration: Duration.zero,
        placeholder: (_, _) => const ColoredBox(color: Colors.black),
        errorWidget: (_, _, _) => const ColoredBox(color: Colors.black),
      ),
    );
  }
}
