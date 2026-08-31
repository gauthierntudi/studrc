import 'package:flutter/material.dart';
import '../core/constants.dart';

class AppTheme {
  static const navy = Color(kBrandNavy);
  static const gold = Color(kBrandGold);
  static const red = Color(kBrandRed);
  static const blue = Color(kBrandBlue);

  /// UI / corps — même stack que le site.
  static const sans = 'PlusJakartaSans';

  /// Titres / display — même stack que le site.
  static const display = 'Archivo';

  static TextStyle displayText({
    double size = 22,
    FontWeight weight = FontWeight.w700,
    double height = 1.2,
    Color? color,
    double letterSpacing = -0.2,
  }) {
    return TextStyle(
      fontFamily: display,
      fontFamilyFallback: const [sans],
      fontSize: size,
      fontWeight: weight,
      height: height,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle sansText({
    double size = 16,
    FontWeight weight = FontWeight.w400,
    double height = 1.5,
    Color? color,
    double letterSpacing = 0,
  }) {
    return TextStyle(
      fontFamily: sans,
      fontSize: size,
      fontWeight: weight,
      height: height,
      color: color,
      letterSpacing: letterSpacing,
    );
  }

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: navy,
      brightness: Brightness.light,
      primary: navy,
      secondary: gold,
      error: red,
    );
    return _theme(scheme, Colors.white, navy);
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
    return _theme(scheme, navy, ink);
  }

  static ThemeData _theme(
    ColorScheme scheme,
    Color scaffold,
    Color appBarForeground,
  ) {
    final text = _textTheme(
      ThemeData(brightness: scheme.brightness).textTheme,
      scheme.onSurface,
    );
    return ThemeData(
      useMaterial3: true,
      fontFamily: sans,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffold,
      textTheme: text,
      primaryTextTheme: text,
      appBarTheme: AppBarTheme(
        backgroundColor: scaffold,
        foregroundColor: appBarForeground,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: displayText(
          size: 18,
          weight: FontWeight.w700,
          color: appBarForeground,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return sansText(
            size: 12,
            weight: selected ? FontWeight.w700 : FontWeight.w500,
            height: 1.2,
          );
        }),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        selectedItemColor: scheme.brightness == Brightness.dark ? gold : navy,
        unselectedItemColor: scheme.brightness == Brightness.dark
            ? const Color(0xFF9AA3B2)
            : const Color(0xFF6B6B6B),
        selectedLabelStyle: sansText(size: 12, weight: FontWeight.w700),
        unselectedLabelStyle: sansText(size: 12, weight: FontWeight.w500),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          textStyle: sansText(size: 16, weight: FontWeight.w700, height: 1.2),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: sansText(size: 14, weight: FontWeight.w600, height: 1.2),
        ),
      ),
      chipTheme: ChipThemeData(
        labelStyle: sansText(size: 13, weight: FontWeight.w700, height: 1.2),
      ),
    );
  }

  static TextTheme _textTheme(TextTheme base, Color onSurface) {
    TextStyle archivo(double size, FontWeight weight, double height) {
      return displayText(
        size: size,
        weight: weight,
        height: height,
        color: onSurface,
      );
    }

    TextStyle jakarta(double size, FontWeight weight, double height) {
      return sansText(
        size: size,
        weight: weight,
        height: height,
        color: onSurface,
      );
    }

    return base.copyWith(
      displayLarge: archivo(32, FontWeight.w800, 1.15),
      displayMedium: archivo(28, FontWeight.w800, 1.15),
      displaySmall: archivo(24, FontWeight.w700, 1.2),
      headlineLarge: archivo(26, FontWeight.w800, 1.2),
      headlineMedium: archivo(22, FontWeight.w700, 1.2),
      headlineSmall: archivo(18, FontWeight.w700, 1.25),
      titleLarge: archivo(17, FontWeight.w700, 1.25),
      titleMedium: jakarta(15, FontWeight.w600, 1.35),
      titleSmall: jakarta(13, FontWeight.w600, 1.3),
      bodyLarge: jakarta(16, FontWeight.w400, 1.5),
      bodyMedium: jakarta(14, FontWeight.w400, 1.45),
      bodySmall: jakarta(12, FontWeight.w400, 1.4),
      labelLarge: jakarta(14, FontWeight.w600, 1.2),
      labelMedium: jakarta(12, FontWeight.w600, 1.2),
      labelSmall: jakarta(11, FontWeight.w700, 1.2).copyWith(
        letterSpacing: 0.35,
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
