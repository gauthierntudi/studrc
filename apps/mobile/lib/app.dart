import 'package:flutter/material.dart';
import 'core/router.dart';
import 'theme/app_theme.dart';

class StudrcApp extends StatelessWidget {
  const StudrcApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'STUDRC',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      routerConfig: appRouter,
    );
  }
}
