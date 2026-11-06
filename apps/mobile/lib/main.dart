import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:media_kit/media_kit.dart';
import 'app.dart';
import 'core/appearance.dart';
import 'core/onboarding.dart';

Future<void> main() async {
  final binding = WidgetsFlutterBinding.ensureInitialized();
  if (!kIsWeb) {
    FlutterNativeSplash.preserve(widgetsBinding: binding);
  }
  MediaKit.ensureInitialized();
  await initializeDateFormatting('fr');
  final onboarding = await OnboardingController.load();
  final appearance = await AppearanceController.load();
  runApp(
    ProviderScope(
      overrides: [
        onboardingProvider.overrideWith((ref) => onboarding),
        appearanceProvider.overrideWith((ref) => appearance),
      ],
      child: const StudrcApp(),
    ),
  );
  if (!kIsWeb) {
    FlutterNativeSplash.remove();
  }
}
