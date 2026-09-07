import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'models.dart';

class NowPlaying {
  const NowPlaying({
    required this.slug,
    required this.title,
    required this.src,
    this.poster,
    this.minimized = false,
  });

  final String slug;
  final String title;
  final String src;
  final String? poster;
  final bool minimized;

  NowPlaying copyWith({bool? minimized}) {
    return NowPlaying(
      slug: slug,
      title: title,
      src: src,
      poster: poster,
      minimized: minimized ?? this.minimized,
    );
  }
}

class NowPlayingController extends StateNotifier<NowPlaying?> {
  NowPlayingController() : super(null);

  /// Surface unique : ne jamais démonter le [Video] en réduisant.
  final GlobalKey videoSurfaceKey = GlobalKey();

  Player? _player;
  VideoController? _video;
  bool _keepPlaying = false;
  int _playGen = 0;

  NowPlaying? get session => state;
  bool get keepPlaying => _keepPlaying;

  Player get player {
    _player ??= Player();
    return _player!;
  }

  VideoController get video {
    _video ??= VideoController(player);
    return _video!;
  }

  Future<void> start(ArticleDetail article) async {
    final src = article.videoHlsUrl;
    if (src == null || src.isEmpty) return;
    final same = state?.src == src;
    if (!same) _keepPlaying = true;
    state = NowPlaying(
      slug: article.slug,
      title: article.title,
      src: src,
      poster: article.videoPosterUrl ?? article.coverUrl,
    );
    if (!same) {
      await player.open(Media(src), play: true);
    } else if (_keepPlaying) {
      await player.play();
    }
    if (_keepPlaying) _playAfterTreeSettles();
  }

  void minimize() {
    final current = state;
    if (current == null || current.minimized) return;
    // Réduire = continuer. media_kit met souvent pause au démontage du Video
    // avant même player.state.playing, donc on ne se fie pas à cet état.
    _keepPlaying = true;
    state = current.copyWith(minimized: true);
    _playAfterTreeSettles();
  }

  Future<void> playOrPause() async {
    if (_player == null) return;
    if (player.state.playing) {
      _keepPlaying = false;
      _playGen++;
      await player.pause();
    } else {
      _keepPlaying = true;
      await player.play();
    }
  }

  /// Après démontage / remontage du widget [Video], media_kit met souvent
  /// pause *après* le premier `play()`. On relance une fois l’arbre posé.
  Future<void> resumeIfKept() async {
    if (!_keepPlaying || _player == null || state == null) return;
    try {
      await player.play();
    } catch (_) {}
  }

  void _playAfterTreeSettles() {
    final gen = ++_playGen;
    void later(VoidCallback fn) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (gen != _playGen) return;
        fn();
      });
    }

    later(() {
      resumeIfKept();
      later(() {
        resumeIfKept();
        Future<void>.delayed(const Duration(milliseconds: 80), () {
          if (gen != _playGen) return;
          resumeIfKept();
        });
      });
    });
  }

  void stop() {
    _keepPlaying = false;
    _playGen++;
    _player?.stop();
    state = null;
  }

  @override
  void dispose() {
    _playGen++;
    _player?.dispose();
    super.dispose();
  }
}

final nowPlayingProvider =
    StateNotifierProvider<NowPlayingController, NowPlaying?>((ref) {
      return NowPlayingController();
    });
