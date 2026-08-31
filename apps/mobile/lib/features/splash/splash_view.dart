import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_theme.dart';
import '../../widgets/studrc_logo.dart';

class SplashView extends StatelessWidget {
  const SplashView({super.key});

  @override
  Widget build(BuildContext context) {
    return const AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: ColoredBox(
        color: AppTheme.navy,
        child: Center(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 48),
            child: StudrcLogo(height: 88),
          ),
        ),
      ),
    );
  }
}
