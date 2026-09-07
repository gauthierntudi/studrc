import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../core/now_playing.dart';
import '../../theme/app_theme.dart';

final shortsFeedProvider = FutureProvider<CategoryFeed>((ref) {
  return ref.watch(apiClientProvider).byCategory('stu-short', take: 40);
});

/// Fil vertical type TikTok / YouTube Shorts.
class ShortsFeedView extends ConsumerStatefulWidget {
  const ShortsFeedView({super.key, this.initialSlug});

  final String? initialSlug;

  @override
  ConsumerState<ShortsFeedView> createState() => _ShortsFeedViewState();
}

class _ShortsFeedViewState extends ConsumerState<ShortsFeedView> {
  PageController? _pages;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(nowPlayingProvider.notifier).stop();
    });
  }

  @override
  void dispose() {
    _pages?.dispose();
    super.dispose();
  }

  int _initialIndex(List<ArticleCard> items) {
    final slug = widget.initialSlug;
    if (slug == null || slug.isEmpty) return 0;
    final i = items.indexWhere((a) => a.slug == slug);
    return i >= 0 ? i : 0;
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(shortsFeedProvider);

    return ColoredBox(
      color: Colors.black,
      child: async.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppTheme.gold),
        ),
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
          _pages ??= PageController(initialPage: _initialIndex(feed.items));
          return PageView.builder(
            controller: _pages,
            scrollDirection: Axis.vertical,
            itemCount: feed.items.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) => _ShortPage(
              article: feed.items[i],
              active: i == _index,
            ),
          );
        },
      ),
    );
  }
}

class _ShortPage extends ConsumerStatefulWidget {
  const _ShortPage({required this.article, required this.active});

  final ArticleCard article;
  final bool active;

  @override
  ConsumerState<_ShortPage> createState() => _ShortPageState();
}

class _ShortPageState extends ConsumerState<_ShortPage> {
  static const _savedKey = 'saved.article.ids';

  Player? _player;
  VideoController? _video;
  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration>? _durSub;
  StreamSubscription<bool>? _playSub;
  bool _playing = false;
  bool _muted = false;
  bool _saved = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  @override
  void initState() {
    super.initState();
    _restoreSaved();
    _boot();
  }

  Future<void> _restoreSaved() async {
    final prefs = await SharedPreferences.getInstance();
    final ids = prefs.getStringList(_savedKey) ?? const [];
    if (mounted) setState(() => _saved = ids.contains(widget.article.id));
  }

  void _boot() {
    final src = widget.article.videoHlsUrl;
    if (!widget.article.hasReadyVideo || src == null || src.isEmpty) return;
    final player = Player();
    _player = player;
    _video = VideoController(player);
    player.setPlaylistMode(PlaylistMode.single);
    player.open(Media(src), play: widget.active);
    _posSub = player.stream.position.listen((pos) {
      if (mounted) setState(() => _position = pos);
    });
    _durSub = player.stream.duration.listen((d) {
      if (mounted) setState(() => _duration = d);
    });
    _playSub = player.stream.playing.listen((playing) {
      if (mounted) setState(() => _playing = playing);
    });
  }

  @override
  void didUpdateWidget(covariant _ShortPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active == widget.active) return;
    final player = _player;
    if (player == null) return;
    if (widget.active) {
      player.play();
    } else {
      player.pause();
    }
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _playSub?.cancel();
    _player?.dispose();
    super.dispose();
  }

  void _togglePlay() {
    final player = _player;
    if (player == null) return;
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
    final poster = article.videoPosterUrl ?? article.coverUrl;
    final progress = _duration.inMilliseconds <= 0
        ? 0.0
        : (_position.inMilliseconds / _duration.inMilliseconds).clamp(0.0, 1.0);
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return GestureDetector(
      onTap: _togglePlay,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const ColoredBox(color: Colors.black),
          if (_video != null)
            Video(
              controller: _video!,
              fit: BoxFit.cover,
              fill: Colors.black,
              controls: NoVideoControls,
              wakelock: widget.active,
              pauseUponEnteringBackgroundMode: true,
            )
          else if (poster != null && poster.isNotEmpty)
            CachedNetworkImage(imageUrl: poster, fit: BoxFit.cover)
          else
            const ColoredBox(color: Colors.black),
          if (!_playing && _video != null)
            const Center(
              child: Icon(
                Icons.play_arrow_rounded,
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
                  icon: _saved
                      ? Icons.bookmark_rounded
                      : Icons.bookmark_border_rounded,
                  label: _saved ? 'Sauvé' : 'Sauver',
                  onTap: _toggleSaved,
                ),
                const SizedBox(height: 18),
                _ShortAction(
                  icon: Icons.ios_share_rounded,
                  label: 'Partager',
                  onTap: _share,
                ),
                const SizedBox(height: 18),
                _ShortAction(
                  icon: _muted
                      ? Icons.volume_off_rounded
                      : Icons.volume_up_rounded,
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
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

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
            child: Icon(icon, color: Colors.white, size: 26),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: AppTheme.sansText(
              size: 11,
              weight: FontWeight.w600,
              color: Colors.white,
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
                icon: const Icon(Icons.keyboard_arrow_down_rounded),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
