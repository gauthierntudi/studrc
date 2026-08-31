import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:media_kit/media_kit.dart';
import 'app.dart';
import 'core/onboarding.dart';

Future<void> main() async {
  final binding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: binding);
  MediaKit.ensureInitialized();
  await initializeDateFormatting('fr');
  final onboarding = await OnboardingController.load();
  runApp(
    ProviderScope(
      overrides: [
        onboardingProvider.overrideWith((ref) => onboarding),
      ],
      child: const StudrcApp(),
    ),
  );
  FlutterNativeSplash.remove();
}
