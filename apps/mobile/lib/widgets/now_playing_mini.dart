import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/now_playing.dart';
import '../theme/app_theme.dart';

/// Chrome de la barre mini (titre, pause, fermer). La texture vidéo
/// est posée par l’overlay sur le slot 114×64 de gauche.
class NowPlayingMiniBar extends ConsumerStatefulWidget {
  const NowPlayingMiniBar({
    super.key,
    required this.session,
    this.onOpen,
  });

  final NowPlaying session;
  final VoidCallback? onOpen;

  @override
  ConsumerState<NowPlayingMiniBar> createState() => _NowPlayingMiniBarState();
}

class _NowPlayingMiniBarState extends ConsumerState<NowPlayingMiniBar> {
  StreamSubscription<bool>? _sub;
  bool _playing = false;

  @override
  void initState() {
    super.initState();
    final player = ref.read(nowPlayingProvider.notifier).player;
    _playing = player.state.playing;
    _sub = player.stream.playing.listen((playing) {
      if (mounted) setState(() => _playing = playing);
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ctrl = ref.read(nowPlayingProvider.notifier);
    final poster = widget.session.poster;

    return Material(
      elevation: 16,
      color: dark ? const Color(0xFF0A1C33) : Colors.white,
      shadowColor: Colors.black.withValues(alpha: 0.32),
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        height: 64,
        child: Row(
          children: [
            SizedBox(
              width: 114,
              height: 64,
              child: poster != null && poster.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: poster,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) =>
                          const ColoredBox(color: Colors.black),
                    )
                  : const ColoredBox(color: Colors.black),
            ),
            Expanded(
              child: InkWell(
                onTap: widget.onOpen,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 8, 4, 8),
                  child: Text(
                    widget.session.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.displayText(
                      size: 13,
                      weight: FontWeight.w700,
                      height: 1.25,
                      color: scheme.onSurface,
                    ),
                  ),
                ),
              ),
            ),
            IconButton(
              tooltip: _playing ? 'Pause' : 'Lecture',
              onPressed: ctrl.playOrPause,
              icon: Icon(
                _playing ? LucideIcons.pause : LucideIcons.play,
              ),
            ),
            IconButton(
              tooltip: 'Fermer',
              onPressed: ctrl.stop,
              icon: const Icon(LucideIcons.x),
            ),
          ],
        ),
      ),
    );
  }
}
