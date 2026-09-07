import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';

/// Lecteur HLS style YouTube (barre, ±10 s, double-tap, plein écran).
class StudrcVideoPlayer extends StatefulWidget {
  const StudrcVideoPlayer({
    super.key,
    required this.src,
    this.poster,
    this.accent = AppTheme.gold,
    this.radius = 8,
    this.autoplay = false,
    this.showControls = true,
    this.wakelock = true,
    this.player,
    this.controller,
    this.videoKey,
    this.fullscreen = false,
    this.onToggleFullscreen,
  }) : assert(
         (player == null) == (controller == null),
         'player et controller doivent être fournis ensemble',
       );

  final String src;
  final String? poster;

  /// Jaune charte pour la barre, le play et le spinner.
  final Color accent;
  final double radius;
  final bool autoplay;
  final bool showControls;
  final bool wakelock;

  /// Lecteur partagé (mini-player). S’il est fourni, ce widget ne l’ouvre
  /// pas et ne le détruit pas.
  final Player? player;
  final VideoController? controller;

  /// Clé stable pour déplacer le [Video] sans recréer la texture.
  final Key? videoKey;
  final bool fullscreen;
  final VoidCallback? onToggleFullscreen;

  @override
  State<StudrcVideoPlayer> createState() => _StudrcVideoPlayerState();
}

class _StudrcVideoPlayerState extends State<StudrcVideoPlayer> {
  late final bool _ownsPlayer = widget.player == null;
  late final Player _player = widget.player ?? Player();
  late final VideoController _controller =
      widget.controller ?? VideoController(_player);
  final List<StreamSubscription<dynamic>> _subs = [];
  bool _playbackRequested = false;
  bool _hasVideoFrame = false;
  bool _muted = false;

  Color get _ink =>
      widget.accent == AppTheme.gold ? AppTheme.navy : Colors.white;

  bool get _showPoster => !_hasVideoFrame;

  @override
  void initState() {
    super.initState();
    if (_ownsPlayer) {
      _playbackRequested = widget.autoplay || _player.state.playing;
      _player.open(Media(widget.src), play: widget.autoplay);
    } else {
      // Le mini-player ouvre déjà avec play:true : pas de bouton Play,
      // mais l’affiche reste jusqu’à la première frame (sinon écran noir).
      _playbackRequested = true;
      if (widget.autoplay) {
        void playSoon() {
          if (!mounted) return;
          _player.play();
        }

        WidgetsBinding.instance.addPostFrameCallback((_) {
          playSoon();
          WidgetsBinding.instance.addPostFrameCallback((_) => playSoon());
        });
      }
    }
    _muted = _player.state.volume <= 0;
    _controller.rect.addListener(_syncHasFrame);
    _controller.id.addListener(_syncHasFrame);
    _syncHasFrame();
    _subs.add(
      _player.stream.playing.listen((playing) {
        if (playing && !_playbackRequested && mounted) {
          setState(() => _playbackRequested = true);
        }
      }),
    );
    _subs.add(_player.stream.width.listen((_) => _syncHasFrame()));
    _subs.add(_player.stream.height.listen((_) => _syncHasFrame()));
    _subs.add(
      _player.stream.volume.listen((volume) {
        final muted = volume <= 0;
        if (muted != _muted && mounted) setState(() => _muted = muted);
      }),
    );
  }

  void _syncHasFrame() {
    final rect = _controller.rect.value;
    final ready = rect != null && rect.width > 1 && rect.height > 1;
    if (ready == _hasVideoFrame) return;
    if (!mounted) {
      _hasVideoFrame = ready;
      return;
    }
    setState(() => _hasVideoFrame = ready);
  }

  @override
  void dispose() {
    _controller.rect.removeListener(_syncHasFrame);
    _controller.id.removeListener(_syncHasFrame);
    for (final sub in _subs) {
      sub.cancel();
    }
    if (_ownsPlayer) {
      _player.dispose();
    }
    super.dispose();
  }

  void _seekBy(Duration delta) {
    HapticFeedback.selectionClick();
    final duration = _player.state.duration;
    final next = _player.state.position + delta;
    final ms = next.inMilliseconds.clamp(0, duration.inMilliseconds);
    _player.seek(Duration(milliseconds: ms));
  }

  void _toggleMute() {
    HapticFeedback.selectionClick();
    if (_muted) {
      _player.setVolume(100);
    } else {
      _player.setVolume(0);
    }
  }

  MaterialVideoControlsThemeData _theme({required bool fullscreen}) {
    return MaterialVideoControlsThemeData(
      displaySeekBar: true,
      automaticallyImplySkipNextButton: false,
      automaticallyImplySkipPreviousButton: false,
      volumeGesture: false,
      brightnessGesture: false,
      seekGesture: true,
      seekOnDoubleTap: true,
      seekOnDoubleTapEnabledWhileControlsVisible: true,
      seekOnDoubleTapBackwardDuration: const Duration(seconds: 10),
      seekOnDoubleTapForwardDuration: const Duration(seconds: 10),
      speedUpOnLongPress: true,
      speedUpFactor: 2,
      visibleOnMount: false,
      backdropColor: const Color(0x66000000),
      controlsHoverDuration: const Duration(seconds: 3),
      controlsTransitionDuration: const Duration(milliseconds: 220),
      primaryButtonBar: [
        const Spacer(flex: 2),
        MaterialCustomButton(
          iconSize: 36,
          onPressed: () => _seekBy(const Duration(seconds: -10)),
          icon: const Icon(LucideIcons.rotateCcw),
        ),
        const Spacer(),
        const MaterialPlayOrPauseButton(iconSize: 64),
        const Spacer(),
        MaterialCustomButton(
          iconSize: 36,
          onPressed: () => _seekBy(const Duration(seconds: 10)),
          icon: const Icon(LucideIcons.rotateCw),
        ),
        const Spacer(flex: 2),
      ],
      bottomButtonBar: [
        MaterialPositionIndicator(
          style: AppTheme.sansText(
            size: 12,
            weight: FontWeight.w600,
            height: 1,
            color: Colors.white,
          ),
        ),
        const Spacer(),
        MaterialCustomButton(
          onPressed: _toggleMute,
          icon: Icon(
            _muted ? LucideIcons.volumeX : LucideIcons.volume2,
          ),
        ),
        if (widget.onToggleFullscreen != null)
          MaterialCustomButton(
            onPressed: widget.onToggleFullscreen!,
            icon: Icon(
              widget.fullscreen ? LucideIcons.minimize : LucideIcons.maximize,
            ),
          ),
      ],
      bottomButtonBarMargin: EdgeInsets.only(
        left: 12,
        right: 4,
        bottom: fullscreen ? 28 : 8,
      ),
      buttonBarHeight: 48,
      buttonBarButtonSize: 24,
      buttonBarButtonColor: Colors.white,
      seekBarMargin: EdgeInsets.only(
        left: 12,
        right: 12,
        bottom: fullscreen ? 28 : 8,
      ),
      seekBarHeight: 3,
      seekBarContainerHeight: 36,
      seekBarColor: const Color(0x59FFFFFF),
      seekBarBufferColor: const Color(0x8AFFFFFF),
      seekBarPositionColor: widget.accent,
      seekBarThumbColor: widget.accent,
      seekBarThumbSize: 14,
      bufferingIndicatorBuilder: (_) => Center(
        child: SizedBox(
          width: 42,
          height: 42,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            color: widget.accent,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      clipBehavior: widget.radius == 0 ? Clip.none : Clip.hardEdge,
      child: ColoredBox(
        color: Colors.black,
        child: AspectRatio(
          aspectRatio: 16 / 9,
          child: MaterialVideoControlsTheme(
            normal: _theme(fullscreen: false),
            fullscreen: _theme(fullscreen: true),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Video(
                  key: widget.videoKey,
                  controller: _controller,
                  fill: Colors.black,
                  fit: BoxFit.contain,
                  controls: widget.showControls
                      ? MaterialVideoControls
                      : NoVideoControls,
                  wakelock: widget.wakelock,
                  pauseUponEnteringBackgroundMode: _ownsPlayer,
                  onEnterFullscreen: () async {},
                  onExitFullscreen: () async {},
                ),
                if (_showPoster)
                  _PosterStart(
                    poster: widget.poster,
                    accent: widget.accent,
                    ink: _ink,
                    showPlayButton: !_playbackRequested,
                    onPlay: () {
                      HapticFeedback.lightImpact();
                      setState(() => _playbackRequested = true);
                      _player.play();
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PosterStart extends StatelessWidget {
  const _PosterStart({
    required this.poster,
    required this.accent,
    required this.ink,
    required this.onPlay,
    this.showPlayButton = true,
  });

  final String? poster;
  final Color accent;
  final Color ink;
  final VoidCallback onPlay;
  final bool showPlayButton;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: IgnorePointer(
        ignoring: !showPlayButton,
        child: Semantics(
          button: showPlayButton,
          label: showPlayButton ? 'Lire la vidéo' : null,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: showPlayButton ? onPlay : null,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (poster != null && poster!.isNotEmpty)
                    CachedNetworkImage(
                      imageUrl: poster!,
                      fit: BoxFit.cover,
                      fadeInDuration: Duration.zero,
                      fadeOutDuration: Duration.zero,
                      placeholder: (_, _) =>
                          const ColoredBox(color: Colors.black),
                      errorWidget: (_, _, _) =>
                          const ColoredBox(color: Colors.black),
                    )
                  else
                    const ColoredBox(color: Colors.black),
                  ColoredBox(
                    color: Color(showPlayButton ? 0x59000000 : 0x33000000),
                  ),
                  Center(
                    child: showPlayButton
                        ? Container(
                            width: 72,
                            height: 48,
                            decoration: BoxDecoration(
                              color: accent,
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.35),
                                  blurRadius: 16,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Icon(LucideIcons.play, color: ink, size: 32),
                          )
                        : SizedBox(
                            width: 42,
                            height: 42,
                            child: CircularProgressIndicator(
                              strokeWidth: 3,
                              color: accent,
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
