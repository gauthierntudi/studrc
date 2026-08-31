import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:studrc/app.dart';
import 'package:studrc/core/onboarding.dart';

void main() {
  testWidgets('returning user sees the tab shell', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: StudrcApp(showSplash: false)),
    );
    expect(find.text('Accueil'), findsOneWidget);
    await tester.pump(const Duration(seconds: 21));
  });

  testWidgets('first launch shows onboarding', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          onboardingProvider.overrideWith((ref) => OnboardingController(false)),
        ],
        child: const StudrcApp(showSplash: false),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Bienvenue sur STUDRC'), findsOneWidget);
    expect(find.text('Passer'), findsOneWidget);
    expect(find.text('Continuer'), findsOneWidget);
  });

  testWidgets('skipping onboarding opens the app', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          onboardingProvider.overrideWith((ref) => OnboardingController(false)),
        ],
        child: const StudrcApp(showSplash: false),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Passer'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Accueil'), findsOneWidget);
    await tester.pump(const Duration(seconds: 21));
  });
}
