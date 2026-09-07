import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
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
    this.fullscreen = false,
  });

  final String slug;
  final String title;
  final String src;
  final String? poster;
  final bool minimized;
  final bool fullscreen;

  NowPlaying copyWith({bool? minimized, bool? fullscreen}) {
    return NowPlaying(
      slug: slug,
      title: title,
      src: src,
      poster: poster,
      minimized: minimized ?? this.minimized,
      fullscreen: fullscreen ?? this.fullscreen,
    );
  }
}

class NowPlayingController extends StateNotifier<NowPlaying?> {
  NowPlayingController() : super(null);

  Player? _player;
  VideoController? _video;
  bool _keepPlaying = false;

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
    if (same) {
      if (state?.minimized == true) expand();
      return;
    }
    await _restoreSystemUi();
    await _resetPlayback();
    _keepPlaying = true;
    state = NowPlaying(
      slug: article.slug,
      title: article.title,
      src: src,
      poster: article.videoPosterUrl ?? article.coverUrl,
    );
    await player.open(Media(src), play: true);
  }

  void minimize() {
    final current = state;
    if (current == null || current.minimized) return;
    if (current.fullscreen) {
      _restoreSystemUi();
    }
    _keepPlaying = player.state.playing || _keepPlaying;
    state = current.copyWith(minimized: true, fullscreen: false);
  }

  void expand() {
    final current = state;
    if (current == null || !current.minimized) return;
    state = current.copyWith(minimized: false);
  }

  Future<void> toggleFullscreen() async {
    final current = state;
    if (current == null) return;
    if (current.fullscreen) {
      await _restoreSystemUi();
      state = current.copyWith(fullscreen: false);
      return;
    }
    _keepPlaying = player.state.playing || _keepPlaying;
    state = current.copyWith(minimized: false, fullscreen: true);
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    await SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  }

  Future<void> playOrPause() async {
    if (_player == null) return;
    if (player.state.playing) {
      _keepPlaying = false;
      await player.pause();
    } else {
      _keepPlaying = true;
      await player.play();
    }
  }

  Future<void> resumeIfKept() async {
    if (!_keepPlaying || _player == null || state == null) return;
    if (player.state.playing) return;
    try {
      await player.play();
    } catch (_) {}
  }

  void stop() {
    _keepPlaying = false;
    state = null;
    _restoreSystemUi();
    _disposePlayerSoon();
  }

  Future<void> _resetPlayback() async {
    state = null;
    final old = _player;
    _player = null;
    _video = null;
    if (old == null) return;
    try {
      await old.dispose();
    } catch (_) {}
  }

  void _disposePlayerSoon() {
    final old = _player;
    _player = null;
    _video = null;
    if (old == null) return;
    SchedulerBinding.instance.addPostFrameCallback((_) {
      old.dispose();
    });
  }

  Future<void> _restoreSystemUi() async {
    try {
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
      await SystemChrome.setPreferredOrientations(const [
        DeviceOrientation.portraitUp,
      ]);
    } catch (_) {}
  }

  @override
  void dispose() {
    _restoreSystemUi();
    _player?.dispose();
    super.dispose();
  }
}

final nowPlayingProvider =
    StateNotifierProvider<NowPlayingController, NowPlaying?>((ref) {
      return NowPlayingController();
    });
