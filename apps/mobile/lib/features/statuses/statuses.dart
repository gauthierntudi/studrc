import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api.dart';
import '../../core/article_nav.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../core/now_playing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/studrc_logo.dart';

/// Statuts actifs (publiés et non expirés), du plus récent au plus ancien.
final statusesProvider = FutureProvider<List<StatusItem>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final now = DateTime.now();
  final items = await api.statuses();
  return items.where((s) => s.expiresAt.isAfter(now)).toList();
});

/// Identifiants des statuts déjà vus (persistés localement).
final seenStatusesProvider =
    StateNotifierProvider<SeenStatusesController, Set<String>>(
      (ref) => SeenStatusesController(),
    );

class SeenStatusesController extends StateNotifier<Set<String>> {
  SeenStatusesController() : super(const <String>{}) {
    unawaited(_load());
  }

  static const _key = 'studrc.seen_statuses';
  static const _max = 300;

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList(_key) ?? const <String>[];
    if (!mounted) return;
    state = {...state, ...saved};
  }

  Future<void> markSeen(String id) async {
    if (state.contains(id)) return;
    final next = [...state, id];
    final trimmed = next.length > _max
        ? next.sublist(next.length - _max)
        : next;
    state = trimmed.toSet();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_key, trimmed);
  }
}

/// Ordre d’affichage : non vus d’abord, puis vus (récents en premier).
List<StatusItem> orderStatuses(List<StatusItem> items, Set<String> seen) {
  return [
    ...items.where((s) => !seen.contains(s.id)),
    ...items.where((s) => seen.contains(s.id)),
  ];
}

String statusAgo(DateTime when) {
  final diff = DateTime.now().difference(when);
  if (diff.inMinutes < 1) return 'à l’instant';
  if (diff.inMinutes < 60) return 'il y a ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'il y a ${diff.inHours} h';
  return 'il y a ${diff.inDays} j';
}

// ------------------------------------------------------------------ bulles

class StatusBubbles extends ConsumerWidget {
  const StatusBubbles({
    super.key,
    this.padding = EdgeInsets.zero,
    this.bleed = 0,
  });

  final EdgeInsetsGeometry padding;

  /// Débord horizontal pour ignorer le padding du parent (défilement bord à bord).
  final double bleed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(statusesProvider).valueOrNull ?? const [];
    if (items.isEmpty) return const SizedBox.shrink();
    final seen = ref.watch(seenStatusesProvider);
    final ordered = orderStatuses(items, seen);

    return Padding(
      padding: padding,
      child: LayoutBuilder(
        builder: (context, box) => SizedBox(
          height: 98,
          child: OverflowBox(
            minWidth: box.maxWidth + bleed * 2,
            maxWidth: box.maxWidth + bleed * 2,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: ordered.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, i) {
                final s = ordered[i];
                return _Bubble(
                  status: s,
                  seen: seen.contains(s.id),
                  onTap: () => openStatusViewer(context, ordered, i),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.status,
    required this.seen,
    required this.onTap,
  });

  final StatusItem status;
  final bool seen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final thumb = status.thumbUrl;
    final ring = seen
        ? LinearGradient(
            colors: [
              scheme.onSurface.withValues(alpha: 0.22),
              scheme.onSurface.withValues(alpha: 0.22),
            ],
          )
        : const LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [AppTheme.gold, AppTheme.red, Color(0xFFC026D3)],
          );

    return Semantics(
      button: true,
      label: 'Statut : ${status.label}',
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: 70,
          child: Column(
            children: [
              Container(
                width: 68,
                height: 68,
                padding: const EdgeInsets.all(2.5),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: ring,
                ),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Theme.of(context).scaffoldBackgroundColor,
                  ),
                  child: ClipOval(
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (thumb != null && thumb.isNotEmpty)
                          CachedNetworkImage(
                            imageUrl: thumb,
                            fit: BoxFit.cover,
                            memCacheWidth: 200,
                            errorWidget: (_, _, _) => const _BubbleFallback(),
                            placeholder: (_, _) => const _BubbleFallback(),
                          )
                        else
                          const _BubbleFallback(),
                        if (status.isVideo)
                          const Align(
                            alignment: Alignment.center,
                            child: Icon(
                              Icons.play_arrow_rounded,
                              color: Colors.white,
                              size: 26,
                              shadows: [Shadow(blurRadius: 8)],
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                status.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: AppTheme.sansText(
                  size: 11.5,
                  height: 1.2,
                  weight: seen ? FontWeight.w500 : FontWeight.w700,
                  color: scheme.onSurface.withValues(alpha: seen ? 0.6 : 0.9),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BubbleFallback extends StatelessWidget {
  const _BubbleFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(kBrandNavy), Color(kBrandBlue)],
        ),
      ),
      child: Padding(
        padding: EdgeInsets.all(14),
        child: FittedBox(child: StudrcLogo(height: 20)),
      ),
    );
  }
}

// ------------------------------------------------------------------ viewer

Future<void> openStatusViewer(
  BuildContext context,
  List<StatusItem> items,
  int initialIndex,
) {
  final hostContext = context;
  return Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder<void>(
      opaque: true,
      fullscreenDialog: true,
      transitionDuration: const Duration(milliseconds: 220),
      reverseTransitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (_, _, _) => StatusViewerScreen(
        items: items,
        initialIndex: initialIndex,
        onOpenArticle: (article) {
          if (hostContext.mounted) openArticleCard(hostContext, article);
        },
      ),
      transitionsBuilder: (_, anim, _, child) => FadeTransition(
        opacity: anim,
        child: ScaleTransition(
          scale: Tween(begin: 0.96, end: 1.0).animate(anim),
          child: child,
        ),
      ),
    ),
  );
}

class StatusViewerScreen extends ConsumerStatefulWidget {
  const StatusViewerScreen({
    super.key,
    required this.items,
    required this.initialIndex,
    required this.onOpenArticle,
  });

  final List<StatusItem> items;
  final int initialIndex;
  final void Function(ArticleCard article) onOpenArticle;

  @override
  ConsumerState<StatusViewerScreen> createState() => _StatusViewerScreenState();
}

class _StatusViewerScreenState extends ConsumerState<StatusViewerScreen>
    with SingleTickerProviderStateMixin {
  /// Statut (bulle) affiché
  late int _index = widget.initialIndex.clamp(0, widget.items.length - 1);

  /// Diapo affichée dans ce statut
  int _slide = 0;

  /// Statuts déjà comptés comme vus pendant cette ouverture
  final _counted = <String>{};
  late final AnimationController _timer = AnimationController(vsync: this)
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed) _next();
    });

  Player? _player;
  VideoController? _video;
  final _subs = <StreamSubscription<dynamic>>[];
  double _videoProgress = 0;
  bool _videoReady = false;
  bool _loading = true;
  bool _paused = false;
  double _dragDy = 0;
  int _loadToken = 0;

  StatusItem get _status => widget.items[_index];
  StatusSlide get _current =>
      _status.slides[_slide.clamp(0, _status.slides.length - 1)];

  static bool _isTextOnly(StatusSlide s) =>
      !s.isImage && !s.isVideo && s.article == null;

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _pauseNowPlaying();
    WidgetsBinding.instance.addPostFrameCallback((_) => _show());
  }

  @override
  void dispose() {
    for (final s in _subs) {
      unawaited(s.cancel());
    }
    _timer.dispose();
    final player = _player;
    _player = null;
    if (player != null) unawaited(player.dispose());
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _pauseNowPlaying() {
    final np = ref.read(nowPlayingProvider.notifier);
    if (np.session == null) return;
    try {
      if (np.player.state.playing) unawaited(np.player.pause());
    } catch (_) {}
  }

  Future<void> _ensurePlayer() async {
    if (_player != null) return;
    final player = Player();
    final video = VideoController(player);
    _player = player;
    _video = video;
    _subs
      ..add(
        player.stream.position.listen((pos) {
          final total = player.state.duration;
          if (!mounted || !_current.isVideo || total.inMilliseconds <= 0) {
            return;
          }
          setState(() {
            _videoProgress = (pos.inMilliseconds / total.inMilliseconds).clamp(
              0.0,
              1.0,
            );
          });
        }),
      )
      ..add(
        player.stream.completed.listen((done) {
          if (done && mounted && _current.isVideo) _next();
        }),
      )
      ..add(
        player.stream.buffering.listen((b) {
          if (!mounted || !_current.isVideo) return;
          setState(() => _loading = b && !_videoReady);
        }),
      );
    await video.platform.future;
  }

  Future<void> _show() async {
    final token = ++_loadToken;
    final group = _status;
    final status = _current;
    _timer
      ..stop()
      ..value = 0;
    setState(() {
      _loading = true;
      _videoReady = false;
      _videoProgress = 0;
      _paused = false;
    });

    if (_counted.add(group.id)) {
      unawaited(ref.read(seenStatusesProvider.notifier).markSeen(group.id));
      unawaited(ref.read(apiClientProvider).markStatusViewed(group.id));
    }
    _precacheNext();

    if (status.isVideo) {
      await _ensurePlayer();
      if (!mounted || token != _loadToken) return;
      final player = _player!;
      await player.setVolume(100);
      await player.open(Media(status.mediaUrl!), play: true);
      unawaited(
        _video!.waitUntilFirstFrameRendered.then((_) {
          if (!mounted || token != _loadToken) return;
          setState(() {
            _videoReady = true;
            _loading = false;
          });
        }),
      );
      return;
    }

    await _player?.stop();
    if (!mounted || token != _loadToken) return;
    final bg = status.isImage ? status.mediaUrl : status.article?.coverUrl;
    if (bg != null && bg.isNotEmpty) {
      try {
        if (!mounted) return;
        await precacheImage(CachedNetworkImageProvider(bg), context);
      } catch (_) {}
    }
    if (!mounted || token != _loadToken) return;
    setState(() => _loading = false);
    final secs = status.isImage
        ? status.durationSec
        : status.durationSec.clamp(6, 15);
    _timer
      ..duration = Duration(seconds: secs)
      ..forward(from: 0);
  }

  void _precacheNext() {
    final StatusSlide next;
    if (_slide + 1 < _status.slides.length) {
      next = _status.slides[_slide + 1];
    } else if (_index + 1 < widget.items.length) {
      next = widget.items[_index + 1].first;
    } else {
      return;
    }
    final url = next.thumbUrl;
    if (url == null || url.isEmpty) return;
    unawaited(
      precacheImage(
        CachedNetworkImageProvider(url),
        context,
      ).catchError((_) {}),
    );
  }

  /// Diapo suivante, puis statut suivant ; ferme à la fin.
  void _next() {
    if (_slide + 1 < _status.slides.length) {
      setState(() => _slide++);
      _show();
      return;
    }
    _nextStatus();
  }

  /// Diapo précédente, sinon début du statut précédent.
  void _prev() {
    if (_slide > 0) {
      setState(() => _slide--);
      _show();
      return;
    }
    _prevStatus();
  }

  void _nextStatus() {
    if (_index + 1 >= widget.items.length) {
      _close();
      return;
    }
    setState(() {
      _index++;
      _slide = 0;
    });
    _show();
  }

  void _prevStatus() {
    setState(() {
      if (_index > 0) _index--;
      _slide = 0;
    });
    _show();
  }

  void _close() {
    _timer.stop();
    unawaited(_player?.pause());
    if (mounted) Navigator.of(context).maybePop();
    unawaited(ref.read(nowPlayingProvider.notifier).resumeIfKept());
  }

  void _pause() {
    if (_paused) return;
    _paused = true;
    _timer.stop();
    if (_current.isVideo) unawaited(_player?.pause());
    setState(() {});
  }

  void _resume() {
    if (!_paused) return;
    _paused = false;
    if (_current.isVideo) {
      unawaited(_player?.play());
    } else if (!_loading) {
      _timer.forward();
    }
    setState(() {});
  }

  void _openArticle(ArticleCard article) {
    _timer.stop();
    unawaited(_player?.pause());
    Navigator.of(context).pop();
    widget.onOpenArticle(article);
  }

  @override
  Widget build(BuildContext context) {
    final group = _status;
    final status = _current;
    final pad = MediaQuery.paddingOf(context);
    final article = status.article;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapUp: (d) {
          final w = MediaQuery.sizeOf(context).width;
          if (d.localPosition.dx < w * 0.3) {
            _prev();
          } else {
            _next();
          }
        },
        // Balayage horizontal : statut suivant / précédent
        onHorizontalDragEnd: (d) {
          final v = d.primaryVelocity ?? 0;
          if (v < -250) {
            _nextStatus();
          } else if (v > 250) {
            _prevStatus();
          }
        },
        onLongPressStart: (_) => _pause(),
        onLongPressEnd: (_) => _resume(),
        onVerticalDragStart: (_) => _pause(),
        onVerticalDragUpdate: (d) {
          setState(() => _dragDy = (_dragDy + d.delta.dy).clamp(0.0, 400.0));
        },
        onVerticalDragEnd: (d) {
          if (_dragDy > 110 || (d.primaryVelocity ?? 0) > 700) {
            _close();
          } else {
            setState(() => _dragDy = 0);
            _resume();
          }
        },
        child: Transform.translate(
          offset: Offset(0, _dragDy),
          child: Opacity(
            opacity: (1 - _dragDy / 600).clamp(0.4, 1.0),
            child: Stack(
              fit: StackFit.expand,
              children: [
                _StatusBackground(
                  key: ValueKey('${group.id}/${status.id}'),
                  status: status,
                  video: status.isVideo ? _video : null,
                  videoReady: _videoReady,
                ),
                // Dégradés de lisibilité
                const IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: [0, 0.18, 0.55, 1],
                        colors: [
                          Color(0x99000000),
                          Color(0x00000000),
                          Color(0x00000000),
                          Color(0xCC000000),
                        ],
                      ),
                    ),
                  ),
                ),
                if (_loading)
                  const Center(
                    child: SizedBox(
                      width: 32,
                      height: 32,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    ),
                  ),
                Positioned(
                  top: pad.top + 8,
                  left: 10,
                  right: 10,
                  child: Column(
                    children: [
                      _ProgressBars(
                        count: group.slides.length,
                        index: _slide,
                        timer: _timer,
                        videoProgress: status.isVideo ? _videoProgress : null,
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Container(
                            width: 34,
                            height: 34,
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Color(kBrandNavy),
                            ),
                            child: const FittedBox(
                              child: StudrcLogo(height: 16),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text.rich(
                              TextSpan(
                                children: [
                                  const TextSpan(
                                    text: 'STUDRC',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  TextSpan(
                                    text: '  ${statusAgo(group.publishedAt)}',
                                    style: const TextStyle(
                                      color: Colors.white70,
                                    ),
                                  ),
                                ],
                              ),
                              style: AppTheme.sansText(
                                size: 13.5,
                                color: Colors.white,
                                height: 1.2,
                              ),
                            ),
                          ),
                          if (_paused)
                            const Padding(
                              padding: EdgeInsets.only(right: 4),
                              child: Icon(
                                Icons.pause_rounded,
                                color: Colors.white,
                              ),
                            ),
                          IconButton(
                            onPressed: _close,
                            tooltip: 'Fermer',
                            icon: const Icon(
                              Icons.close_rounded,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (_isTextOnly(status))
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: Text(
                        status.caption?.trim() ?? '',
                        textAlign: TextAlign.center,
                        style: AppTheme.displayText(
                          size: 28,
                          color: Colors.white,
                          height: 1.3,
                        ),
                      ),
                    ),
                  )
                else
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: pad.bottom + 20,
                    child: _StatusFooter(
                      status: status,
                      onOpenArticle: article == null
                          ? null
                          : () => _openArticle(article),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProgressBars extends StatelessWidget {
  const _ProgressBars({
    required this.count,
    required this.index,
    required this.timer,
    required this.videoProgress,
  });

  final int count;
  final int index;
  final AnimationController timer;
  final double? videoProgress;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: timer,
      builder: (context, _) {
        final current = videoProgress ?? timer.value;
        return Row(
          children: [
            for (var i = 0; i < count; i++) ...[
              if (i > 0) SizedBox(width: count > 20 ? 2 : 4),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    minHeight: 2.5,
                    value: i < index ? 1 : (i == index ? current : 0),
                    backgroundColor: Colors.white.withValues(alpha: 0.35),
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _StatusBackground extends StatelessWidget {
  const _StatusBackground({
    super.key,
    required this.status,
    required this.video,
    required this.videoReady,
  });

  final StatusSlide status;
  final VideoController? video;
  final bool videoReady;

  @override
  Widget build(BuildContext context) {
    if (status.isVideo) {
      final poster = status.posterUrl;
      return Stack(
        fit: StackFit.expand,
        children: [
          if (poster != null && poster.isNotEmpty)
            CachedNetworkImage(imageUrl: poster, fit: BoxFit.cover),
          if (video != null)
            AnimatedOpacity(
              opacity: videoReady ? 1 : 0,
              duration: const Duration(milliseconds: 180),
              child: Video(
                controller: video!,
                fit: BoxFit.cover,
                fill: Colors.transparent,
                controls: NoVideoControls,
                wakelock: true,
              ),
            ),
        ],
      );
    }

    final url = status.isImage ? status.mediaUrl : status.article?.coverUrl;
    if (url != null && url.isNotEmpty && status.fitsImage) {
      // Fit : image entière sur fond noir, centrée selon sa taille.
      return ColoredBox(
        color: Colors.black,
        child: Center(
          child: CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.contain,
            fadeInDuration: const Duration(milliseconds: 120),
            errorWidget: (_, _, _) => const _TextBackground(),
          ),
        ),
      );
    }
    if (url != null && url.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        fadeInDuration: const Duration(milliseconds: 120),
        errorWidget: (_, _, _) => const _TextBackground(),
      );
    }
    return const _TextBackground();
  }
}

class _TextBackground extends StatelessWidget {
  const _TextBackground();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(kBrandNavy), Color(kBrandBlue)],
        ),
      ),
    );
  }
}

class _StatusFooter extends StatelessWidget {
  const _StatusFooter({required this.status, required this.onOpenArticle});

  final StatusSlide status;
  final VoidCallback? onOpenArticle;

  @override
  Widget build(BuildContext context) {
    final caption = status.caption?.trim();
    final article = status.article;
    final hasMedia = status.isImage || status.isVideo;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!hasMedia && article != null) ...[
          if (article.categoryLabel.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.toneColor(articleToneOf(article)),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                article.categoryLabel.toUpperCase(),
                style: AppTheme.sansText(
                  size: 11,
                  weight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: 0.6,
                  height: 1.2,
                ),
              ),
            ),
          const SizedBox(height: 10),
          Text(
            article.title,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: AppTheme.displayText(size: 26, color: Colors.white),
          ),
          const SizedBox(height: 10),
        ],
        if (caption != null && caption.isNotEmpty)
          Text(
            caption,
            maxLines: 6,
            overflow: TextOverflow.ellipsis,
            style: AppTheme.sansText(
              size: 16,
              color: Colors.white,
              weight: FontWeight.w500,
              height: 1.4,
            ),
          ),
        if (onOpenArticle != null) ...[
          const SizedBox(height: 16),
          Center(
            child: FilledButton.icon(
              onPressed: onOpenArticle,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(
                  horizontal: 22,
                  vertical: 12,
                ),
                shape: const StadiumBorder(),
              ),
              icon: const Icon(Icons.arrow_upward_rounded, size: 18),
              label: Text(
                'Lire l’article',
                style: AppTheme.sansText(
                  size: 14.5,
                  weight: FontWeight.w700,
                  color: Colors.black,
                  height: 1.2,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
