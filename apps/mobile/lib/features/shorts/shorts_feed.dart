import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../core/now_playing.dart';
import '../../theme/app_theme.dart';

bool _shortsPlaybackAllowed(BuildContext context, bool tabActive) {
  if (!tabActive) return false;
  if (!TickerMode.valuesOf(context).enabled) return false;

  final rootNav = Navigator.maybeOf(context, rootNavigator: true);
  final localNav = Navigator.maybeOf(context);
  if (rootNav == null) return true;
  if (localNav == null || identical(localNav, rootNav)) {
    return ModalRoute.of(context)?.isCurrent ?? true;
  }
  return !rootNav.canPop();
}

final shortsFeedProvider = FutureProvider<CategoryFeed>((ref) {
  return ref.watch(apiClientProvider).byCategory('stu-short', take: 40);
});

void precacheShortPosters(
  BuildContext context,
  List<ArticleCard> items, {
  int count = 6,
}) {
  for (final article in items.take(count)) {
    final url = article.videoPosterUrl ?? article.coverUrl;
    if (url == null || url.isEmpty) continue;
    precacheImage(CachedNetworkImageProvider(url), context);
  }
}

String? shortPosterUrl(ArticleCard article) {
  final poster = article.videoPosterUrl ?? article.coverUrl;
  if (poster == null || poster.isEmpty) return null;
  return poster;
}

void precacheShortPostersAround(
  BuildContext context,
  List<ArticleCard> items,
  int index,
) {
  if (items.isEmpty) return;
  final from = index.clamp(0, items.length - 1);
  final to = (index + 4).clamp(0, items.length);
  precacheShortPosters(context, items.sublist(from, to), count: 8);
}

class _WarmSlot {
  _WarmSlot({required this.player, required this.controller});

  final Player player;
  final VideoController controller;
  bool hasFrame = false;
  bool disposed = false;
}

/// Lecteurs HLS partagés : le Short courant + les 2 suivants, même si
/// leur page n’est pas encore construite par le PageView.
class _ShortsPlayerPool extends ChangeNotifier {
  static const _ahead = 2;
  static const _config = PlayerConfiguration(bufferSize: 8 * 1024 * 1024);

  final Map<String, _WarmSlot> _slots = {};
  int _syncGen = 0;
  bool _closed = false;

  _WarmSlot? slot(String id) => _slots[id];

  void _emit() {
    if (_closed) return;
    notifyListeners();
  }

  Future<void> sync({
    required List<ArticleCard> items,
    required int index,
    required bool active,
  }) async {
    if (items.isEmpty) {
      await clear();
      return;
    }

    final gen = ++_syncGen;
    index = index.clamp(0, items.length - 1);

    final order = <int>[index];
    if (active) {
      for (var step = 1; step <= _ahead; step++) {
        if (index + step < items.length) order.add(index + step);
      }
      if (index > 0) order.add(index - 1);
    }

    final keep = {for (final i in order) items[i].id};
    for (final id in _slots.keys.where((id) => !keep.contains(id)).toList()) {
      await _release(id);
    }
    if (gen != _syncGen) return;

    for (final i in order) {
      if (gen != _syncGen) return;
      await _ensure(items[i], play: active && i == index);
    }
  }

  Future<void> _ensure(ArticleCard article, {required bool play}) async {
    final src = article.videoHlsUrl;
    if (!article.hasReadyVideo || src == null || src.isEmpty) return;

    var slot = _slots[article.id];
    if (slot == null) {
      final player = Player(configuration: _config);
      final controller = VideoController(player);
      final created = _WarmSlot(player: player, controller: controller);
      _slots[article.id] = created;
      _emit();
      try {
        await controller.platform.future;
        if (created.disposed) return;
        await player.setPlaylistMode(PlaylistMode.single);
        if (created.disposed) return;
        await player.setVolume(play ? 100 : 0);
        if (created.disposed) return;
        await player.open(Media(src), play: play);
        if (created.disposed) return;
        unawaited(
          controller.waitUntilFirstFrameRendered.then((_) {
            if (created.disposed) return;
            created.hasFrame = true;
            _emit();
          }, onError: (_, _) {}),
        );
      } catch (_) {
        if (!created.disposed) await _release(article.id);
        return;
      }
      _emit();
      return;
    }

    if (play) {
      await slot.player.play();
    } else {
      await slot.player.pause();
      await slot.player.setVolume(0);
    }
  }

  void pauseAll() {
    for (final slot in _slots.values) {
      unawaited(slot.player.pause());
      unawaited(slot.player.setVolume(0));
    }
  }

  Future<void> _release(String id) async {
    final slot = _slots.remove(id);
    if (slot == null) return;
    slot.disposed = true;
    _emit();
    try {
      await slot.player.dispose();
    } catch (_) {}
  }

  Future<void> shutdown() async {
    _closed = true;
    await clear();
  }

  Future<void> clear() async {
    _syncGen++;
    final slots = _slots.values.toList();
    _slots.clear();
    for (final slot in slots) {
      slot.disposed = true;
      try {
        await slot.player.dispose();
      } catch (_) {}
    }
  }
}

/// Fil vertical type TikTok / YouTube Shorts.
class ShortsFeedView extends ConsumerStatefulWidget {
  const ShortsFeedView({super.key, this.initialSlug, this.active = true});

  final String? initialSlug;

  /// Onglet / écran visible. Hors écran, on coupe le son mais on garde le
  /// Short courant prêt pour y revenir sans écran noir.
  final bool active;

  @override
  ConsumerState<ShortsFeedView> createState() => _ShortsFeedViewState();
}

class _ShortsFeedViewState extends ConsumerState<ShortsFeedView>
    with AutomaticKeepAliveClientMixin {
  final _pool = _ShortsPlayerPool();
  PageController? _pages;
  List<ArticleCard> _items = const [];
  int _index = 0;
  Listenable? _routerListenable;
  bool _allowed = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(nowPlayingProvider.notifier).stop();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = GoRouter.maybeOf(context)?.routerDelegate;
    if (!identical(next, _routerListenable)) {
      _routerListenable?.removeListener(_onRouteChanged);
      _routerListenable = next;
      _routerListenable?.addListener(_onRouteChanged);
    }
  }

  void _onRouteChanged() {
    if (!mounted) return;
    setState(() {});
  }

  @override
  void didUpdateWidget(covariant ShortsFeedView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active != widget.active) _syncPool();
  }

  @override
  void dispose() {
    _routerListenable?.removeListener(_onRouteChanged);
    _pages?.dispose();
    unawaited(_pool.shutdown());
    _pool.dispose();
    super.dispose();
  }

  int _initialIndex(List<ArticleCard> items) {
    final slug = widget.initialSlug;
    if (slug == null || slug.isEmpty) return 0;
    final i = items.indexWhere((a) => a.slug == slug);
    return i >= 0 ? i : 0;
  }

  bool _playAt(int i, bool allowed) => allowed && i == _index;

  void _syncPool() {
    if (!mounted || _items.isEmpty) return;
    precacheShortPostersAround(context, _items, _index);
    unawaited(
      _pool.sync(items: _items, index: _index, active: widget.active),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final allowed = _shortsPlaybackAllowed(context, widget.active);
    if (allowed != _allowed) {
      _allowed = allowed;
      if (!allowed) {
        _pool.pauseAll();
      } else {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _syncPool();
        });
      }
    }
    final async = ref.watch(shortsFeedProvider);

    ref.listen(shortsFeedProvider, (prev, next) {
      final items = next.valueOrNull?.items;
      if (items == null || !context.mounted) return;
      precacheShortPosters(context, items);
    });

    return ColoredBox(
      color: Colors.black,
      child: async.when(
        loading: () => const _ShortsLoading(),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              ref.read(apiClientProvider).apiError(e),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ),
        data: (feed) {
          if (feed.items.isEmpty) {
            return const Center(
              child: Text(
                'Pas encore de Shorts.',
                style: TextStyle(color: Colors.white70),
              ),
            );
          }
          final first = _pages == null;
          _items = feed.items;
          _pages ??= PageController(initialPage: _initialIndex(feed.items));
          if (first) {
            WidgetsBinding.instance.addPostFrameCallback((_) => _syncPool());
          }
          return PageView.builder(
            controller: _pages,
            scrollDirection: Axis.vertical,
            allowImplicitScrolling: true,
            itemCount: feed.items.length,
            onPageChanged: (i) {
              setState(() => _index = i);
              _syncPool();
            },
            itemBuilder: (context, i) => _ShortPage(
              key: ValueKey(feed.items[i].id),
              pool: _pool,
              article: feed.items[i],
              play: _playAt(i, allowed),
            ),
          );
        },
      ),
    );
  }
}

class _ShortsLoading extends StatelessWidget {
  const _ShortsLoading();

  @override
  Widget build(BuildContext context) {
    return const Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: Color(0xFF0B1220)),
        Center(
          child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              color: AppTheme.gold,
              strokeWidth: 2.4,
            ),
          ),
        ),
      ],
    );
  }
}

class _ShortPage extends ConsumerStatefulWidget {
  const _ShortPage({
    super.key,
    required this.pool,
    required this.article,
    required this.play,
  });

  final _ShortsPlayerPool pool;
  final ArticleCard article;
  final bool play;

  @override
  ConsumerState<_ShortPage> createState() => _ShortPageState();
}

class _ShortPageState extends ConsumerState<_ShortPage> {
  static const _savedKey = 'saved.article.ids';
  static const _likedKey = 'liked.article.ids';

  _WarmSlot? _bound;
  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration>? _durSub;
  StreamSubscription<bool>? _playSub;
  bool _playing = false;
  bool _muted = false;
  bool _saved = false;
  bool _liked = false;
  bool _hasFrame = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  Player? get _player => _bound?.player;

  @override
  void initState() {
    super.initState();
    widget.pool.addListener(_onPool);
    _bind(widget.pool.slot(widget.article.id), notify: false);
    _restoreFlags();
  }

  void _onPool() {
    final slot = widget.pool.slot(widget.article.id);
    if (slot != _bound) {
      _bind(slot);
      return;
    }
    if (!mounted || slot == null) return;
    if (slot.hasFrame != _hasFrame) {
      setState(() => _hasFrame = slot.hasFrame);
    }
  }

  void _bind(_WarmSlot? slot, {bool notify = true}) {
    _posSub?.cancel();
    _durSub?.cancel();
    _playSub?.cancel();
    _bound = slot;
    if (slot == null) {
      _playing = false;
      _hasFrame = false;
      _position = Duration.zero;
      _duration = Duration.zero;
      if (notify && mounted) setState(() {});
      return;
    }

    _hasFrame = slot.hasFrame;
    _playing = slot.player.state.playing;
    _position = slot.player.state.position;
    _duration = slot.player.state.duration;
    _posSub = slot.player.stream.position.listen((pos) {
      if (mounted) setState(() => _position = pos);
    });
    _durSub = slot.player.stream.duration.listen((d) {
      if (mounted) setState(() => _duration = d);
    });
    _playSub = slot.player.stream.playing.listen((playing) {
      if (mounted) setState(() => _playing = playing);
    });
    if (notify && mounted) setState(() {});
    _applyPlayMute();
  }

  void _applyPlayMute() {
    final player = _player;
    if (player == null) return;
    if (widget.play) {
      player.setVolume(_muted ? 0 : 100);
      player.play();
    } else {
      player.pause();
      player.setVolume(0);
    }
  }

  Future<void> _restoreFlags() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList(_savedKey) ?? const [];
    final liked = prefs.getStringList(_likedKey) ?? const [];
    if (mounted) {
      setState(() {
        _saved = saved.contains(widget.article.id);
        _liked = liked.contains(widget.article.id);
      });
    }
  }

  @override
  void didUpdateWidget(covariant _ShortPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pool != widget.pool) {
      oldWidget.pool.removeListener(_onPool);
      widget.pool.addListener(_onPool);
      _bind(widget.pool.slot(widget.article.id));
    }
    if (oldWidget.play != widget.play) _applyPlayMute();
  }

  @override
  void dispose() {
    widget.pool.removeListener(_onPool);
    _posSub?.cancel();
    _durSub?.cancel();
    _playSub?.cancel();
    super.dispose();
  }

  void _togglePlay() {
    final player = _player;
    if (player == null || !_hasFrame) return;
    HapticFeedback.selectionClick();
    if (player.state.playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  void _toggleMute() {
    final player = _player;
    if (player == null) return;
    HapticFeedback.selectionClick();
    if (_muted) {
      player.setVolume(100);
      setState(() => _muted = false);
    } else {
      player.setVolume(0);
      setState(() => _muted = true);
    }
  }

  Future<void> _toggleLiked() async {
    final prefs = await SharedPreferences.getInstance();
    final ids = [...?prefs.getStringList(_likedKey)];
    if (_liked) {
      ids.remove(widget.article.id);
    } else {
      ids.add(widget.article.id);
    }
    await prefs.setStringList(_likedKey, ids);
    HapticFeedback.lightImpact();
    if (mounted) setState(() => _liked = !_liked);
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

  @override
  Widget build(BuildContext context) {
    final article = widget.article;
    final poster = shortPosterUrl(article);
    final progress = _duration.inMilliseconds <= 0
        ? 0.0
        : (_position.inMilliseconds / _duration.inMilliseconds).clamp(0.0, 1.0);
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    final pixelWidth =
        (MediaQuery.sizeOf(context).width * MediaQuery.devicePixelRatioOf(context))
            .round();

    return GestureDetector(
      onTap: _togglePlay,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const ColoredBox(color: Color(0xFF0B1220)),
          if (_bound != null)
            Video(
              controller: _bound!.controller,
              fit: BoxFit.cover,
              fill: Colors.black,
              controls: NoVideoControls,
              wakelock: widget.play,
              pauseUponEnteringBackgroundMode: true,
            ),
          IgnorePointer(
            child: AnimatedOpacity(
              opacity: _hasFrame ? 0 : 1,
              duration: const Duration(milliseconds: 180),
              child: poster == null
                  ? const ColoredBox(color: Color(0xFF0B1220))
                  : CachedNetworkImage(
                      imageUrl: poster,
                      fit: BoxFit.cover,
                      fadeInDuration: Duration.zero,
                      fadeOutDuration: Duration.zero,
                      memCacheWidth: pixelWidth,
                      placeholder: (_, _) =>
                          const ColoredBox(color: Color(0xFF0B1220)),
                      errorWidget: (_, _, _) =>
                          const ColoredBox(color: Color(0xFF0B1220)),
                    ),
            ),
          ),
          if (!_hasFrame)
            const IgnorePointer(
              child: Center(
                child: SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(
                    color: AppTheme.gold,
                    strokeWidth: 2.4,
                  ),
                ),
              ),
            ),
          if (_hasFrame && !_playing)
            const Center(
              child: Icon(
                LucideIcons.play,
                color: Colors.white,
                size: 72,
              ),
            ),
          const IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0x66000000),
                    Color(0x00000000),
                    Color(0x00000000),
                    Color(0xCC000000),
                  ],
                  stops: [0, 0.18, 0.55, 1],
                ),
              ),
            ),
          ),
          Positioned(
            left: 16,
            right: 88,
            bottom: 18 + bottomPad,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'SHORT',
                  style: AppTheme.sansText(
                    size: 11,
                    weight: FontWeight.w800,
                    letterSpacing: 1.4,
                    color: AppTheme.gold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  article.title,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.displayText(
                    size: 20,
                    weight: FontWeight.w800,
                    height: 1.2,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  [
                    article.authorName,
                    if (article.dateLabel.isNotEmpty) article.dateLabel,
                  ].join(' · '),
                  style: AppTheme.sansText(
                    size: 13,
                    weight: FontWeight.w600,
                    color: Colors.white70,
                  ),
                ),
                if (article.chapo.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    article.chapo,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.sansText(
                      size: 13,
                      height: 1.35,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Positioned(
            right: 8,
            bottom: 28 + bottomPad,
            child: Column(
              children: [
                _ShortAction(
                  icon: LucideIcons.heart,
                  label: _liked ? 'Aimé' : 'J’aime',
                  color: _liked ? AppTheme.gold : Colors.white,
                  onTap: _toggleLiked,
                ),
                const SizedBox(height: 18),
                _ShortAction(
                  icon: _saved
                      ? LucideIcons.bookmarkCheck
                      : LucideIcons.bookmark,
                  label: _saved ? 'Sauvé' : 'Sauver',
                  onTap: _toggleSaved,
                ),
                const SizedBox(height: 18),
                _ShortAction(
                  icon: LucideIcons.share2,
                  label: 'Partager',
                  onTap: _share,
                ),
                const SizedBox(height: 18),
                _ShortAction(
                  icon: _muted
                      ? LucideIcons.volumeX
                      : LucideIcons.volume2,
                  label: _muted ? 'Son' : 'Muet',
                  onTap: _toggleMute,
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: IgnorePointer(
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 2.5,
                backgroundColor: Colors.white24,
                color: AppTheme.gold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShortAction extends StatelessWidget {
  const _ShortAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = Colors.white,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.28),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: AppTheme.sansText(
              size: 11,
              weight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Route plein écran (depuis une carte ou une recherche).
class ShortsScreen extends StatelessWidget {
  const ShortsScreen({super.key, this.initialSlug});

  final String? initialSlug;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          ShortsFeedView(initialSlug: initialSlug),
          Positioned(
            top: 0,
            left: 4,
            child: SafeArea(
              child: IconButton(
                tooltip: 'Retour',
                onPressed: () {
                  if (Navigator.of(context).canPop()) {
                    Navigator.of(context).pop();
                  }
                },
                style: IconButton.styleFrom(
                  foregroundColor: Colors.white,
                  backgroundColor: Colors.black.withValues(alpha: 0.35),
                ),
                icon: const Icon(LucideIcons.chevronDown),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
