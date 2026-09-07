import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_theme.dart';
import 'studrc_logo.dart';

class StudrcMasthead extends StatelessWidget {
  const StudrcMasthead({
    super.key,
    required this.onSearch,
    required this.onNotify,
  });

  final VoidCallback onSearch;
  final VoidCallback onNotify;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = dark ? Colors.white : AppTheme.navy;
    return SizedBox(
      height: 52,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Row(
          children: [
            SizedBox(
              width: 48,
              child: _HeaderIcon(
                icon: LucideIcons.search,
                tooltip: 'Rechercher',
                color: ink,
                onTap: onSearch,
              ),
            ),
            Expanded(
              child: Center(child: StudrcLogo(height: 26, color: ink)),
            ),
            SizedBox(
              width: 48,
              child: _HeaderIcon(
                icon: LucideIcons.bell,
                tooltip: 'Notifications',
                color: ink,
                onTap: onNotify,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon({
    required this.icon,
    required this.tooltip,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: tooltip,
      icon: Icon(icon, size: 24),
      color: color,
      style: IconButton.styleFrom(
        minimumSize: const Size(44, 44),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}
