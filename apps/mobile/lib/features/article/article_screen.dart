import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api.dart';
import '../../core/article_nav.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../core/now_playing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/cover.dart';
import '../../widgets/studrc_video_player.dart';
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _nowPlaying.resumeIfKept();
    });
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
    final url =
        '$kSiteUrl/article/${Uri.encodeComponent(widget.article.slug)}';
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
    final fade = (1 - (_pull / 180)).clamp(0.0, 1.0);
    final pullAreaHeight = MediaQuery.sizeOf(context).width * 9 / 16;
    final topInset = MediaQuery.paddingOf(context).top;
    final session = ref.watch(nowPlayingProvider);
    final nowPlaying = ref.read(nowPlayingProvider.notifier);
    final showVideo = session == null || !session.minimized;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
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
                        if (showVideo)
                          StudrcVideoPlayer(
                            key: nowPlaying.videoSurfaceKey,
                            src: article.videoHlsUrl!,
                            poster:
                                article.videoPosterUrl ?? article.coverUrl,
                            radius: 0,
                            autoplay: nowPlaying.keepPlaying,
                            player: nowPlaying.player,
                            controller: nowPlaying.video,
                          )
                        else
                          const AspectRatio(
                            aspectRatio: 16 / 9,
                            child: ColoredBox(color: Colors.black),
                          ),
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
                            icon: const Icon(
                              Icons.keyboard_arrow_down_rounded,
                            ),
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
                          label: canExpand
                              ? 'Afficher la description'
                              : null,
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
                                    Icons.expand_more_rounded,
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
                            child: Text(
                              [
                                if (article.authorName != null &&
                                    article.authorName!.trim().isNotEmpty)
                                  article.authorName,
                                if (date != null) date,
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTheme.sansText(
                                size: 13,
                                weight: FontWeight.w600,
                                color: scheme.onSurface.withValues(alpha: 0.55),
                              ),
                            ),
                          ),
                          IconButton(
                            tooltip: _saved ? 'Retirer' : 'Enregistrer',
                            onPressed: _toggleSaved,
                            visualDensity: VisualDensity.compact,
                            icon: Icon(
                              _saved
                                  ? Icons.bookmark_rounded
                                  : Icons.bookmark_border_rounded,
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
                              Icons.ios_share_rounded,
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
    final threshold = MediaQuery.sizeOf(context).height * 0.7;
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

  Future<void> _copyLink() async {
    await Clipboard.setData(ClipboardData(text: _webUrl));
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Lien copié')));
  }

  Future<void> _openSite() {
    return launchUrl(Uri.parse(_webUrl), mode: LaunchMode.externalApplication);
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
    final date = _dateLabel(article.publishedAt);
    final related = ref.watch(relatedProvider(article.slug));
    final surface = Theme.of(context).scaffoldBackgroundColor;
    final scheme = Theme.of(context).colorScheme;
    final wash = AppTheme.toneColor(
      article.categoryTone ??
          toneFromCategory(article.category, article.categoryLabel),
    );
    final ink = wash.computeLuminance() > 0.45 ? AppTheme.navy : Colors.white;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: wash.computeLuminance() > 0.45
          ? SystemUiOverlayStyle.dark
          : SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: wash,
        body: Stack(
          children: [
            CustomScrollView(
              controller: _scroll,
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              slivers: [
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: size.height,
                    child: _ArticleHero(
                      article: article,
                      date: date,
                      saved: _saved,
                      wash: wash,
                      ink: ink,
                      onSave: _toggleSaved,
                      onShare: _share,
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: surface,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(28),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(24, 28, 24, 0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (article.excerpt != null &&
                                  article.excerpt!.trim().isNotEmpty) ...[
                                Text(
                                  article.excerpt!,
                                  style: AppTheme.sansText(
                                    size: 17,
                                    height: 1.5,
                                    color: scheme.onSurface.withValues(
                                      alpha: 0.88,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 22),
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
                              crossAxisAlignment: CrossAxisAlignment.start,
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
              ],
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                color: _compactChrome ? wash : Colors.transparent,
                child: SafeArea(
                  bottom: false,
                  child: SizedBox(
                    height: 48,
                    child: Row(
                      children: [
                        _HeroIconButton(
                          icon: Icons.arrow_back_rounded,
                          tooltip: 'Retour',
                          onPressed: _back,
                          color: ink,
                        ),
                        if (_compactChrome)
                          Expanded(
                            child: Text(
                              article.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTheme.displayText(
                                size: 16,
                                weight: FontWeight.w700,
                                color: ink,
                              ),
                            ),
                          )
                        else
                          const Spacer(),
                        PopupMenuButton<String>(
                          tooltip: 'Plus',
                          iconColor: ink,
                          icon: const Icon(Icons.more_vert_rounded),
                          onSelected: (value) {
                            switch (value) {
                              case 'share':
                                _share();
                              case 'copy':
                                _copyLink();
                              case 'open':
                                _openSite();
                            }
                          },
                          itemBuilder: (context) => const [
                            PopupMenuItem(
                              value: 'share',
                              child: Text('Partager'),
                            ),
                            PopupMenuItem(
                              value: 'copy',
                              child: Text('Copier le lien'),
                            ),
                            PopupMenuItem(
                              value: 'open',
                              child: Text('Ouvrir sur le site'),
                            ),
                          ],
                        ),
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

class _ArticleHero extends StatelessWidget {
  const _ArticleHero({
    required this.article,
    required this.date,
    required this.saved,
    required this.wash,
    required this.ink,
    required this.onSave,
    required this.onShare,
  });

  final ArticleDetail article;
  final String? date;
  final bool saved;
  final Color wash;
  final Color ink;
  final VoidCallback onSave;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final url = article.coverUrl;
    final image = url == null || url.isEmpty
        ? ColoredBox(color: wash)
        : CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.cover,
            alignment: const Alignment(0, -0.12),
            width: double.infinity,
            height: double.infinity,
            placeholder: (_, _) => ColoredBox(color: wash),
            errorWidget: (_, _, _) => ColoredBox(color: wash),
          );

    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: wash),
        Positioned.fill(
          child: ShaderMask(
            blendMode: BlendMode.dstIn,
            shaderCallback: (rect) {
              return const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFFFFFFF),
                  Color(0xFFFFFFFF),
                  Color(0x99FFFFFF),
                  Color(0x00FFFFFF),
                ],
                stops: [0.0, 0.30, 0.52, 0.78],
              ).createShader(rect);
            },
            child: image,
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(
                    alpha: ink == AppTheme.navy ? 0.08 : 0.38,
                  ),
                  Colors.transparent,
                  wash.withValues(alpha: 0.08),
                  wash.withValues(alpha: 0.55),
                  wash.withValues(alpha: 0.92),
                  wash,
                ],
                stops: const [0.0, 0.20, 0.42, 0.58, 0.72, 0.86],
              ),
            ),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 56, 24, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                if (date != null)
                  Text(
                    date!,
                    style: AppTheme.sansText(
                      size: 14,
                      weight: FontWeight.w500,
                      color: ink.withValues(alpha: 0.92),
                    ),
                  ),
                const SizedBox(height: 10),
                Text(
                  article.title,
                  maxLines: 6,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.displayText(
                    size: 32,
                    weight: FontWeight.w800,
                    height: 1.12,
                    letterSpacing: -0.4,
                    color: ink,
                  ),
                ),
                const SizedBox(height: 28),
                Row(
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: ink == AppTheme.navy
                            ? AppTheme.navy
                            : AppTheme.gold,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'S',
                        style: AppTheme.displayText(
                          size: 13,
                          weight: FontWeight.w800,
                          height: 1,
                          color: ink == AppTheme.navy
                              ? Colors.white
                              : AppTheme.navy,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'STUDRC',
                      style: AppTheme.sansText(
                        size: 13,
                        weight: FontWeight.w600,
                        color: ink,
                      ),
                    ),
                    const Spacer(),
                    _HeroIconButton(
                      icon: saved
                          ? Icons.bookmark_rounded
                          : Icons.bookmark_border_rounded,
                      tooltip: saved ? 'Retirer' : 'Enregistrer',
                      onPressed: onSave,
                      color: saved && ink != AppTheme.navy
                          ? AppTheme.gold
                          : ink,
                    ),
                    _HeroIconButton(
                      icon: Icons.ios_share_rounded,
                      tooltip: 'Partager',
                      onPressed: onShare,
                      color: ink,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _HeroIconButton extends StatelessWidget {
  const _HeroIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.color = Colors.white,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      tooltip: tooltip,
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
      icon: Icon(icon, color: color, size: 24),
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
    final available =
        MediaQuery.sizeOf(context).width - (padH > 0 ? padH : 32);
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

String? _dateLabel(String? publishedAt) {
  if (publishedAt == null) return null;
  return DateFormat(
    'd MMMM y',
    'fr',
  ).format(DateTime.tryParse(publishedAt) ?? DateTime.now());
}

/// Date relative pour les vidéos : `2j`, `3 semaines`, `1 mois`, puis date complète après 30 jours.
String? _videoDateLabel(String? publishedAt) {
  if (publishedAt == null) return null;
  final parsed = DateTime.tryParse(publishedAt);
  if (parsed == null) return null;
  final posted = parsed.toLocal();
  final now = DateTime.now();
  final days = DateTime(now.year, now.month, now.day)
      .difference(DateTime(posted.year, posted.month, posted.day))
      .inDays;
  if (days <= 0) return 'Aujourd’hui';
  if (days < 7) return '${days}j';
  if (days < 30) {
    final weeks = days ~/ 7;
    return weeks <= 1 ? '1 semaine' : '$weeks semaines';
  }
  return DateFormat('d MMMM y', 'fr').format(posted);
}
