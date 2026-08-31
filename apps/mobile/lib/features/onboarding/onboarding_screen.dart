import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/onboarding.dart';
import '../../theme/app_theme.dart';
import '../../widgets/studrc_logo.dart';

class OnboardingPageData {
  const OnboardingPageData({
    required this.title,
    required this.body,
    required this.image,
    this.alignment = Alignment.center,
  });

  final String title;
  final String body;
  final String image;
  final Alignment alignment;
}

const _pages = <OnboardingPageData>[
  OnboardingPageData(
    title: 'Bienvenue sur STUDRC',
    body:
        'La plateforme média et observatoire qui éclaire le système éducatif de la République démocratique du Congo.',
    image: 'assets/onboarding/1.jpg',
    alignment: Alignment(0, -0.12),
  ),
  OnboardingPageData(
    title: 'L’actualité éducative',
    body:
        'Stu News, Stu Data, Stu Stories et Stu Talk : information, données, histoires et voix de ceux qui transforment l’école.',
    image: 'assets/onboarding/2.jpg',
    alignment: Alignment(0.12, -0.08),
  ),
  OnboardingPageData(
    title: 'Le kiosque',
    body:
        'Feuilletez les magazines, lisez les numéros gratuits et achetez ceux qui vous intéressent — au même endroit.',
    image: 'assets/onboarding/3.jpg',
    alignment: Alignment(0, -0.18),
  ),
  OnboardingPageData(
    title: 'Explorez librement',
    body:
        'Un compte garde vos achats et notifications. Ce n’est pas obligatoire : vous pouvez commencer tout de suite.',
    image: 'assets/onboarding/4.jpg',
    alignment: Alignment(0, -0.14),
  ),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _last => _index == _pages.length - 1;

  Duration _duration(BuildContext context) {
    return MediaQuery.of(context).disableAnimations
        ? Duration.zero
        : const Duration(milliseconds: 280);
  }

  Future<void> _goTo(int index) async {
    await _controller.animateToPage(
      index,
      duration: _duration(context),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _finish() async {
    await ref.read(onboardingProvider).complete();
  }

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.paddingOf(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppTheme.navy,
        body: Stack(
          fit: StackFit.expand,
          children: [
            PageView.builder(
              controller: _controller,
              itemCount: _pages.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, i) => _FullBleedPhoto(page: _pages[i]),
            ),
            const Positioned.fill(child: _EdgeScrims()),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, padding.top + 8, 8, 0),
                child: Row(
                  children: [
                    const StudrcLogo(height: 42),
                    const Spacer(),
                    if (!_last)
                      TextButton(
                        onPressed: _finish,
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.white,
                          minimumSize: const Size(64, 44),
                        ),
                        child: const Text('Passer'),
                      )
                    else
                      const SizedBox(height: 44, width: 64),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _OverlayCopy(
                page: _pages[_index],
                index: _index,
                count: _pages.length,
                last: _last,
                bottomInset: padding.bottom,
                onNext: () => _last ? _finish() : _goTo(_index + 1),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FullBleedPhoto extends StatelessWidget {
  const _FullBleedPhoto({required this.page});

  final OnboardingPageData page;

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: Image.asset(
        page.image,
        fit: BoxFit.cover,
        alignment: page.alignment,
        semanticLabel: page.title,
      ),
    );
  }
}

class _EdgeScrims extends StatelessWidget {
  const _EdgeScrims();

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0x9900132B),
              Color(0x0000132B),
              Color(0x0000132B),
              Color(0xE600132B),
              Color(0xF200132B),
            ],
            stops: [0, 0.18, 0.42, 0.72, 1],
          ),
        ),
      ),
    );
  }
}

class _OverlayCopy extends StatelessWidget {
  const _OverlayCopy({
    required this.page,
    required this.index,
    required this.count,
    required this.last,
    required this.bottomInset,
    required this.onNext,
  });

  final OnboardingPageData page;
  final int index;
  final int count;
  final bool last;
  final double bottomInset;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 0, 24, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AnimatedSwitcher(
            duration: MediaQuery.of(context).disableAnimations
                ? Duration.zero
                : const Duration(milliseconds: 220),
            child: Column(
              key: ValueKey(page.title),
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  page.title,
                  style: AppTheme.displayText(
                    size: 32,
                    weight: FontWeight.w800,
                    height: 1.15,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  page.body,
                  style: AppTheme.sansText(
                    size: 16,
                    height: 1.5,
                    color: Colors.white.withValues(alpha: 0.86),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          Semantics(
            liveRegion: true,
            label: 'Étape ${index + 1} sur $count',
            child: _Dots(count: count, index: index),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              onPressed: onNext,
              style: FilledButton.styleFrom(
                backgroundColor: AppTheme.gold,
                foregroundColor: AppTheme.navy,
                textStyle: AppTheme.sansText(
                  size: 16,
                  weight: FontWeight.w700,
                  height: 1.2,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(last ? 'Commencer' : 'Continuer'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(count, (i) {
        final active = i == index;
        return AnimatedContainer(
          duration: MediaQuery.of(context).disableAnimations
              ? Duration.zero
              : const Duration(milliseconds: 220),
          margin: const EdgeInsets.only(right: 6),
          width: active ? 22 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: active
                ? AppTheme.gold
                : Colors.white.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(8),
          ),
        );
      }),
    );
  }
}

