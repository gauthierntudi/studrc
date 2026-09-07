import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StudrcFilterTabs extends StatelessWidget {
  const StudrcFilterTabs({
    super.key,
    required this.controller,
    required this.labels,
  });

  final TabController controller;
  final List<String> labels;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final selected = dark ? Colors.white : AppTheme.navy;
    final idle = selected.withValues(alpha: 0.42);
    final line = dark
        ? Colors.white.withValues(alpha: 0.08)
        : const Color(0xFFE6E6E6);

    return Material(
      color: Colors.transparent,
      child: TabBar(
        controller: controller,
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        labelPadding: const EdgeInsets.symmetric(horizontal: 14),
        labelColor: selected,
        unselectedLabelColor: idle,
        labelStyle: AppTheme.displayText(
          size: 13,
          weight: FontWeight.w700,
          height: 1.1,
          letterSpacing: 0.15,
        ),
        unselectedLabelStyle: AppTheme.sansText(
          size: 13,
          weight: FontWeight.w600,
          height: 1.1,
          letterSpacing: 0.1,
        ),
        indicator: const UnderlineTabIndicator(
          borderSide: BorderSide(color: AppTheme.gold, width: 2.5),
        ),
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: line,
        dividerHeight: 0.5,
        splashFactory: NoSplash.splashFactory,
        overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        tabs: [for (final label in labels) Tab(text: label, height: 40)],
      ),
    );
  }
}
