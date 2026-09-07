import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/article_nav.dart';
import '../core/now_playing.dart';
import '../core/router.dart';
import 'now_playing_mini.dart';
import 'studrc_video_player.dart';

/// La texture [Video] vit ici en permanence : reduce / expand animent
/// seulement son rectangle, sans démonter le lecteur (pause fantôme).
class NowPlayingOverlayHost extends ConsumerStatefulWidget {
  const NowPlayingOverlayHost({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<NowPlayingOverlayHost> createState() =>
      _NowPlayingOverlayHostState();
}

class _NowPlayingOverlayHostState extends ConsumerState<NowPlayingOverlayHost>
    with WidgetsBindingObserver {
  OverlayEntry? _entry;
  bool _inserted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _entry ??= OverlayEntry(
      opaque: false,
      maintainState: true,
      builder: (context) => const _NowPlayingStage(),
    );
    if (!_inserted) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _raise());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (!_inserted) _raise();
      ref.read(nowPlayingProvider.notifier).resumeIfKept();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (_inserted) {
      try {
        _entry?.remove();
      } catch (_) {}
      _inserted = false;
    }
    _entry = null;
    super.dispose();
  }

  void _raise({bool force = false}) {
    final entry = _entry;
    if (entry == null || !mounted) return;
    final overlay =
        rootNavigatorKey.currentState?.overlay ??
        Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _raise(force: force);
      });
      return;
    }
    if (_inserted && !force) return;
    if (_inserted && force) {
      try {
        entry.remove();
      } catch (_) {}
      _inserted = false;
    }
    overlay.insert(entry);
    _inserted = true;
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<NowPlaying?>(nowPlayingProvider, (prev, next) {
      if (next != null && !_inserted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _raise();
        });
      }
    });
    return widget.child;
  }
}

class _NowPlayingStage extends ConsumerStatefulWidget {
  const _NowPlayingStage();

  @override
  ConsumerState<_NowPlayingStage> createState() => _NowPlayingStageState();
}

class _NowPlayingStageState extends ConsumerState<_NowPlayingStage>
    with SingleTickerProviderStateMixin {
  static const _miniSize = Size(114, 64);
  static const _duration = Duration(milliseconds: 340);

  final _surfaceKey = GlobalKey();
  late final AnimationController _anim;
  late final Animation<double> _t;

  double _pull = 0;
  Offset? _pointerStart;
  bool _pulling = false;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(vsync: this, duration: _duration);
    _t = CurvedAnimation(
      parent: _anim,
      curve: Curves.easeInOutCubic,
      reverseCurve: Curves.easeInOutCubic,
    );
    final session = ref.read(nowPlayingProvider);
    if (session?.minimized == true) _anim.value = 1;
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  Rect _expandedRect(Size screen) {
    final width = screen.width;
    return Rect.fromLTWH(0, 0, width, width * 9 / 16);
  }

  Rect _miniRect(Size screen, double tabClearance) {
    return Rect.fromLTWH(
      8,
      screen.height - tabClearance - _miniSize.height,
      _miniSize.width,
      _miniSize.height,
    );
  }

  /// 16:9 centré. Le [Video] reste dans le même [Positioned] qu’en
  /// lecture normale : déplacer la texture (autre parent) la noircit.
  Rect _fullscreenRect(Size screen) {
    const ratio = 16 / 9;
    var width = screen.width;
    var height = width / ratio;
    if (height > screen.height) {
      height = screen.height;
      width = height * ratio;
    }
    return Rect.fromCenter(
      center: Offset(screen.width / 2, screen.height / 2),
      width: width,
      height: height,
    );
  }

  void _openWatch(NowPlaying session) {
    ref.read(nowPlayingProvider.notifier).expand();
    ref.read(appRouterProvider).push(
      '/article/${Uri.encodeComponent(session.slug)}',
      extra: rememberedArticleTone(session.slug),
    );
  }

  void _onPointerDown(PointerDownEvent event) {
    if (_anim.value > 0.05) return;
    _pointerStart = event.localPosition;
    _pulling = false;
  }

  void _onPointerMove(PointerMoveEvent event, double areaHeight) {
    if (_anim.value > 0.05) return;
    final start = _pointerStart;
    if (start == null) return;
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
    if (_pulling && _pull > 80) {
      HapticFeedback.lightImpact();
      final ctrl = ref.read(nowPlayingProvider.notifier);
      if (ref.read(nowPlayingProvider)?.fullscreen == true) {
        ctrl.toggleFullscreen();
      } else {
        ctrl.minimize();
      }
      setState(() {
        _pull = 0;
        _pulling = false;
        _pointerStart = null;
      });
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
    final session = ref.watch(nowPlayingProvider);

    ref.listen<NowPlaying?>(nowPlayingProvider, (prev, next) {
      if (next == null) {
        _anim.value = 0;
        return;
      }
      if (next.fullscreen) {
        _anim.value = 0;
        return;
      }
      if (next.minimized) {
        _anim.forward();
      } else if (prev?.minimized == true) {
        _anim.reverse();
      } else {
        _anim.value = 0;
      }
    });

    if (session == null) return const SizedBox.shrink();

    final ctrl = ref.read(nowPlayingProvider.notifier);
    final size = MediaQuery.sizeOf(context);
    final tabClearance = MediaQuery.viewPaddingOf(context).bottom + 72;
    final topInset = MediaQuery.paddingOf(context).top;
    final expanded = _expandedRect(size);
    final mini = _miniRect(size, tabClearance);
    final player = StudrcVideoPlayer(
      key: _surfaceKey,
      src: session.src,
      poster: session.poster,
      radius: 0,
      autoplay: false,
      showControls: !session.minimized,
      wakelock: !session.minimized || session.fullscreen,
      fullscreen: session.fullscreen,
      onToggleFullscreen: ctrl.toggleFullscreen,
      player: ctrl.player,
      controller: ctrl.video,
    );

    final stage = AnimatedBuilder(
      animation: _t,
      child: player,
      builder: (context, child) {
        final fullscreen = session.fullscreen;
        final t = fullscreen ? 0.0 : _t.value;
        final rect = fullscreen
            ? _fullscreenRect(size)
            : Rect.lerp(expanded, mini, t)!;
        final radius = fullscreen ? 0.0 : 12.0 * t;
        final pulled = Offset(
          0,
          _pull * (fullscreen ? 0.7 : 0.45 * (1 - t)),
        );
        final miniT = fullscreen
            ? 0.0
            : Curves.easeOut.transform(t.clamp(0.0, 1.0));
        final backdropOpacity = fullscreen
            ? (1 - _pull / 280).clamp(0.35, 1.0)
            : 1.0;

        return Stack(
          fit: StackFit.expand,
          clipBehavior: Clip.none,
          children: [
            if (fullscreen)
              Positioned.fill(
                child: Listener(
                  onPointerDown: _onPointerDown,
                  onPointerMove: (e) => _onPointerMove(e, size.height),
                  onPointerUp: (_) => _onPointerEnd(),
                  onPointerCancel: (_) => _onPointerEnd(),
                  child: ColoredBox(
                    color: Colors.black.withValues(alpha: backdropOpacity),
                  ),
                ),
              ),
            Positioned(
              left: 8,
              right: 8,
              bottom: tabClearance,
              child: IgnorePointer(
                ignoring: fullscreen || t < 0.55,
                child: Opacity(
                  opacity: miniT,
                  child: NowPlayingMiniBar(
                    session: session,
                    onOpen: () => _openWatch(session),
                  ),
                ),
              ),
            ),
            Positioned(
              left: rect.left + pulled.dx,
              top: rect.top + pulled.dy,
              width: rect.width,
              height: rect.height,
              child: Listener(
                onPointerDown: _onPointerDown,
                onPointerMove: (e) => _onPointerMove(
                  e,
                  fullscreen ? rect.height : expanded.height,
                ),
                onPointerUp: (_) => _onPointerEnd(),
                onPointerCancel: (_) => _onPointerEnd(),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(radius),
                  child: child,
                ),
              ),
            ),
            if (!fullscreen && t < 0.35)
              Positioned(
                top: (topInset > 0 ? topInset - 2 : 4) + pulled.dy,
                left: 4,
                child: Opacity(
                  opacity: (1 - t / 0.35).clamp(0.0, 1.0),
                  child: IconButton(
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      ctrl.minimize();
                    },
                    tooltip: 'Réduire',
                    style: IconButton.styleFrom(
                      foregroundColor: Colors.white,
                      backgroundColor: Colors.black.withValues(alpha: 0.35),
                      minimumSize: const Size(44, 44),
                    ),
                    icon: const Icon(LucideIcons.chevronDown),
                  ),
                ),
              ),
            if (!fullscreen && t > 0.55)
              Positioned(
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => _openWatch(session),
                  onVerticalDragEnd: (details) {
                    if ((details.primaryVelocity ?? 0) < -400) {
                      _openWatch(session);
                    }
                  },
                ),
              ),
          ],
        );
      },
    );

    return BackButtonListener(
      onBackButtonPressed: () async {
        if (!session.fullscreen) return false;
        await ctrl.toggleFullscreen();
        return true;
      },
      child: stage,
    );
  }
}
