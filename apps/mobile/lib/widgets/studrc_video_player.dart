import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../theme/app_theme.dart';

/// Lecteur HLS style YouTube (barre, ±10 s, double-tap, plein écran).
class StudrcVideoPlayer extends StatefulWidget {
  const StudrcVideoPlayer({
    super.key,
    required this.src,
    this.poster,
    this.accent = AppTheme.gold,
    this.radius = 8,
  });

  final String src;
  final String? poster;

  /// Jaune charte pour la barre, le play et le spinner.
  final Color accent;
  final double radius;

  @override
  State<StudrcVideoPlayer> createState() => _StudrcVideoPlayerState();
}

class _StudrcVideoPlayerState extends State<StudrcVideoPlayer> {
  late final Player _player = Player();
  late final VideoController _controller = VideoController(_player);
  final List<StreamSubscription<dynamic>> _subs = [];
  bool _started = false;
  bool _muted = false;

  Color get _ink =>
      widget.accent == AppTheme.gold ? AppTheme.navy : Colors.white;

  @override
  void initState() {
    super.initState();
    _player.open(Media(widget.src), play: false);
    _subs.add(
      _player.stream.playing.listen((playing) {
        if (playing && !_started && mounted) {
          setState(() => _started = true);
        }
      }),
    );
    _subs.add(
      _player.stream.volume.listen((volume) {
        final muted = volume <= 0;
        if (muted != _muted && mounted) setState(() => _muted = muted);
      }),
    );
  }

  @override
  void dispose() {
    for (final sub in _subs) {
      sub.cancel();
    }
    _player.dispose();
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
      volumeGesture: true,
      brightnessGesture: true,
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
          icon: const Icon(Icons.replay_10_rounded),
        ),
        const Spacer(),
        const MaterialPlayOrPauseButton(iconSize: 64),
        const Spacer(),
        MaterialCustomButton(
          iconSize: 36,
          onPressed: () => _seekBy(const Duration(seconds: 10)),
          icon: const Icon(Icons.forward_10_rounded),
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
            _muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
          ),
        ),
        const MaterialFullscreenButton(),
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
                  controller: _controller,
                  fill: Colors.black,
                  fit: BoxFit.contain,
                  controls: MaterialVideoControls,
                  wakelock: true,
                  pauseUponEnteringBackgroundMode: true,
                ),
                if (!_started) _PosterStart(
                  poster: widget.poster,
                  accent: widget.accent,
                  ink: _ink,
                  onPlay: () {
                    HapticFeedback.lightImpact();
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
  });

  final String? poster;
  final Color accent;
  final Color ink;
  final VoidCallback onPlay;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: Semantics(
        button: true,
        label: 'Lire la vidéo',
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPlay,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (poster != null && poster!.isNotEmpty)
                  CachedNetworkImage(
                    imageUrl: poster!,
                    fit: BoxFit.cover,
                    errorWidget: (_, _, _) => const ColoredBox(color: Colors.black),
                  )
                else
                  const ColoredBox(color: Colors.black),
                const ColoredBox(color: Color(0x59000000)),
                Center(
                  child: Container(
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
                    child: Icon(
                      Icons.play_arrow_rounded,
                      color: ink,
                      size: 36,
                    ),
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
