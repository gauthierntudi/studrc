import 'package:flutter/material.dart';
import '../core/constants.dart';

class AppTheme {
  static const navy = Color(kBrandNavy);
  static const gold = Color(kBrandGold);
  static const red = Color(kBrandRed);
  static const blue = Color(kBrandBlue);

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: navy,
      brightness: Brightness.light,
      primary: navy,
      secondary: gold,
      error: red,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: Colors.white,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: navy,
        elevation: 0,
        centerTitle: true,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        selectedItemColor: navy,
        unselectedItemColor: Color(0xFF6B6B6B),
      ),
    );
  }

  static ThemeData dark() {
    const ink = Color(0xFFF2F4F7);
    final scheme = ColorScheme.fromSeed(
      seedColor: navy,
      brightness: Brightness.dark,
      primary: gold,
      secondary: gold,
      surface: const Color(0xFF06203F),
      error: red,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: navy,
      appBarTheme: const AppBarTheme(
        backgroundColor: navy,
        foregroundColor: ink,
        elevation: 0,
        centerTitle: true,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: navy,
        selectedItemColor: gold,
        unselectedItemColor: Color(0xFF9AA3B2),
      ),
    );
  }

  static Color toneColor(String? tone) {
    switch (tone) {
      case 'red':
        return red;
      case 'blue':
        return blue;
      case 'gold':
        return gold;
      case 'teal':
        return navy;
      case 'dark':
        return const Color(0xFFE1045C);
      default:
        return blue;
    }
  }
}
