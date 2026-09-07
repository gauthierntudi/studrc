import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/article_nav.dart';
import '../core/now_playing.dart';
import '../core/router.dart';
import 'now_playing_mini.dart';
import 'studrc_video_player.dart';

/// Overlay uniquement pour la barre mini. Le player plein écran reste
/// sur la page article ; au reduce, la même texture [GlobalKey] glisse ici.
class NowPlayingOverlayHost extends ConsumerStatefulWidget {
  const NowPlayingOverlayHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<NowPlayingOverlayHost> createState() =>
      _NowPlayingOverlayHostState();
}

class _NowPlayingOverlayHostState extends ConsumerState<NowPlayingOverlayHost> {
  OverlayEntry? _entry;
  bool _inserted = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _entry ??= OverlayEntry(
      opaque: false,
      maintainState: true,
      builder: (context) => const _NowPlayingOverlayContent(),
    );
    if (!_inserted) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _raise());
    }
  }

  @override
  void dispose() {
    if (_inserted) {
      _entry?.remove();
      _inserted = false;
    }
    _entry = null;
    super.dispose();
  }

  void _raise() {
    final entry = _entry;
    if (entry == null || !mounted) return;
    final overlay =
        rootNavigatorKey.currentState?.overlay ??
        Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_inserted) _raise();
      });
      return;
    }
    if (_inserted) {
      entry.remove();
      _inserted = false;
    }
    overlay.insert(entry);
    _inserted = true;
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<NowPlaying?>(nowPlayingProvider, (prev, next) {
      if (next != null && next.minimized) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _raise();
        });
      }
    });
    return widget.child;
  }
}

class _NowPlayingOverlayContent extends ConsumerWidget {
  const _NowPlayingOverlayContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(nowPlayingProvider);
    if (session == null || !session.minimized) {
      return const SizedBox.shrink();
    }

    final ctrl = ref.read(nowPlayingProvider.notifier);
    final tabClearance = MediaQuery.viewPaddingOf(context).bottom + 72;

    return Stack(
      fit: StackFit.expand,
      clipBehavior: Clip.none,
      children: [
        Positioned(
          left: 8,
          right: 8,
          bottom: tabClearance,
          child: NowPlayingMiniBar(session: session),
        ),
        Positioned(
          left: 8,
          bottom: tabClearance,
          width: 114,
          height: 64,
          child: ClipRRect(
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(12),
              bottomLeft: Radius.circular(12),
            ),
            child: StudrcVideoPlayer(
              key: ctrl.videoSurfaceKey,
              src: session.src,
              poster: session.poster,
              radius: 0,
              autoplay: false,
              showControls: false,
              wakelock: false,
              player: ctrl.player,
              controller: ctrl.video,
            ),
          ),
        ),
        Positioned(
          left: 8,
          bottom: tabClearance,
          width: 114,
          height: 64,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              ref.read(nowPlayingProvider.notifier).resumeIfKept();
              ref.read(appRouterProvider).push(
                '/article/${Uri.encodeComponent(session.slug)}',
                extra: rememberedArticleTone(session.slug),
              );
            },
            onVerticalDragEnd: (details) {
              if ((details.primaryVelocity ?? 0) < -400) {
                ref.read(nowPlayingProvider.notifier).resumeIfKept();
                ref.read(appRouterProvider).push(
                  '/article/${Uri.encodeComponent(session.slug)}',
                  extra: rememberedArticleTone(session.slug),
                );
              }
            },
          ),
        ),
      ],
    );
  }
}
