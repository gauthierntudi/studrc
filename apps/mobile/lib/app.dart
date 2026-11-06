import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/api.dart';
import 'core/appearance.dart';
import 'core/router.dart';
import 'features/splash/splash_view.dart';
import 'theme/app_theme.dart';
import 'widgets/now_playing_overlay.dart';

class StudrcApp extends ConsumerStatefulWidget {
  const StudrcApp({super.key, this.showSplash = true});

  final bool showSplash;

  @override
  ConsumerState<StudrcApp> createState() => _StudrcAppState();
}

class _StudrcAppState extends ConsumerState<StudrcApp>
    with WidgetsBindingObserver {
  late bool _splash = widget.showSplash;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.portraitUp,
    ]);
    if (!widget.showSplash) return;
    Future<void>.delayed(const Duration(milliseconds: 1100), () {
      if (mounted) setState(() => _splash = false);
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(ref.read(sessionProvider.notifier).restore());
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final appearance = ref.watch(appearanceProvider);
    return MaterialApp.router(
      title: 'STUDRC',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: appearance.themeMode,
      routerConfig: router,
      builder: (context, child) {
        return NowPlayingOverlayHost(
          child: Stack(
            fit: StackFit.expand,
            children: [
              child ?? const SizedBox.shrink(),
              IgnorePointer(
                ignoring: !_splash,
                child: AnimatedOpacity(
                  opacity: _splash ? 1 : 0,
                  duration: MediaQuery.of(context).disableAnimations
                      ? Duration.zero
                      : const Duration(milliseconds: 280),
                  child: const SplashView(),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
