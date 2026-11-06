import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const kThemeModeKey = 'appearance_theme_mode';
const kNotificationsPausedKey = 'notifications_paused';

class AppearanceController extends ChangeNotifier {
  AppearanceController({
    required this.themeMode,
    required this.notificationsPaused,
    this._prefs,
  });

  final SharedPreferences? _prefs;
  ThemeMode themeMode;
  bool notificationsPaused;

  static Future<AppearanceController> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(kThemeModeKey);
    return AppearanceController(
      themeMode: switch (raw) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      },
      notificationsPaused: prefs.getBool(kNotificationsPausedKey) ?? false,
      prefs: prefs,
    );
  }

  bool darkEnabled(BuildContext context) {
    return switch (themeMode) {
      ThemeMode.light => false,
      ThemeMode.dark => true,
      ThemeMode.system =>
        MediaQuery.platformBrightnessOf(context) == Brightness.dark,
    };
  }

  Future<void> setDarkMode(bool enabled) async {
    themeMode = enabled ? ThemeMode.dark : ThemeMode.light;
    await _prefs?.setString(kThemeModeKey, enabled ? 'dark' : 'light');
    notifyListeners();
  }

  Future<void> setNotificationsPaused(bool paused) async {
    notificationsPaused = paused;
    await _prefs?.setBool(kNotificationsPausedKey, paused);
    notifyListeners();
  }
}

final appearanceProvider = ChangeNotifierProvider<AppearanceController>((ref) {
  return AppearanceController(
    themeMode: ThemeMode.system,
    notificationsPaused: false,
  );
});
