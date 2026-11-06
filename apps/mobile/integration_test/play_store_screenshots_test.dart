import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:media_kit/media_kit.dart';
import 'package:studrc/app.dart';
import 'package:studrc/core/appearance.dart';
import 'package:studrc/core/onboarding.dart';

Future<void> _wait(WidgetTester tester) async {
  for (var i = 0; i < 25; i++) {
    await tester.pump(const Duration(milliseconds: 400));
  }
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Play Store screenshots', (tester) async {
    MediaKit.ensureInitialized();
    await initializeDateFormatting('fr');
    final appearance = AppearanceController(
      themeMode: ThemeMode.light,
      notificationsPaused: false,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          onboardingProvider.overrideWith((ref) => OnboardingController(true)),
          appearanceProvider.overrideWith((ref) => appearance),
        ],
        child: const StudrcApp(showSplash: false),
      ),
    );
    await _wait(tester);

    Future<void> shot(String name) async {
      await binding.convertFlutterSurfaceToImage();
      await tester.pump();
      await binding.takeScreenshot(name);
    }

    await shot('01-accueil');

    await tester.tap(find.text('Actualités'));
    await _wait(tester);
    await shot('02-actualites');

    await tester.tap(find.text('Kiosque'));
    await _wait(tester);
    await shot('03-kiosque');

    await tester.tap(find.text('Compte'));
    await _wait(tester);
    await shot('04-compte');
  });
}
