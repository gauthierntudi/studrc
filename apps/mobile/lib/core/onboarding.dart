import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const kOnboardingCompletedKey = 'onboarding_completed';

class OnboardingController extends ChangeNotifier {
  OnboardingController(this._completed, [this._prefs]);

  final SharedPreferences? _prefs;
  bool _completed;

  bool get completed => _completed;

  static Future<OnboardingController> load() async {
    final prefs = await SharedPreferences.getInstance();
    return OnboardingController(
      prefs.getBool(kOnboardingCompletedKey) ?? false,
      prefs,
    );
  }

  Future<void> complete() async {
    if (_completed) return;
    _completed = true;
    await _prefs?.setBool(kOnboardingCompletedKey, true);
    notifyListeners();
  }
}

/// Completed by default so widget tests that skip `main()` land on Accueil.
final onboardingProvider = ChangeNotifierProvider<OnboardingController>((ref) {
  return OnboardingController(true);
});
