import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/now_playing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/studrc_filter_tabs.dart';
import '../../widgets/studrc_masthead.dart';
import '../rubrique/rubrique_screen.dart';
import '../shorts/shorts_feed.dart';

final _newsTabLabels = <String>['Tous', ...kNewsRubriques.map((r) => r.label)];

class NewsScreen extends ConsumerStatefulWidget {
  const NewsScreen({super.key});

  @override
  ConsumerState<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends ConsumerState<NewsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: _newsTabLabels.length, vsync: this);
    _tabs.addListener(() {
      if (!mounted) return;
      setState(() {});
      if (_tabs.index == kNewsRubriques.length) {
        ref.read(nowPlayingProvider.notifier).stop();
      }
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(shortsFeedProvider);
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionProvider);
    final shortTab = _tabs.index == kNewsRubriques.length;
    final tabs = StudrcFilterTabs(controller: _tabs, labels: _newsTabLabels);

    ref.listen(shortsFeedProvider, (prev, next) {
      final items = next.valueOrNull?.items;
      if (items == null || !mounted) return;
      precacheShortPosters(context, items);
    });

    return Scaffold(
      backgroundColor: shortTab
          ? Colors.black
          : Theme.of(context).scaffoldBackgroundColor,
      body: Column(
        children: [
          if (!shortTab)
            SafeArea(
              bottom: false,
              child: Column(
                children: [
                  StudrcMasthead(
                    onSearch: () => context.push('/recherche'),
                    onNotify: () => context.push(
                      user == null ? '/connexion' : '/notifications',
                    ),
                  ),
                  tabs,
                ],
              ),
            ),
          Expanded(
            child: Stack(
              children: [
                TabBarView(
                  controller: _tabs,
                  physics: shortTab
                      ? const NeverScrollableScrollPhysics()
                      : null,
                  children: [
                    const RubriqueFeedView(slug: '', embedded: true),
                    for (final r in kNewsRubriques)
                      r.slug == 'stu-short'
                          ? ShortsFeedView(active: shortTab)
                          : RubriqueFeedView(slug: r.slug, embedded: true),
                  ],
                ),
                if (shortTab)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: DecoratedBox(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0xCC000000), Color(0x00000000)],
                        ),
                      ),
                      child: SafeArea(
                        bottom: false,
                        child: Theme(data: AppTheme.dark(), child: tabs),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
