import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:studrc/widgets/app_icons.dart';
import '../core/appearance.dart';
import '../core/notifications.dart';
import '../theme/app_theme.dart';
import 'studrc_logo.dart';

class StudrcMasthead extends ConsumerWidget {
  const StudrcMasthead({
    super.key,
    required this.onSearch,
    required this.onNotify,
  });

  final VoidCallback onSearch;
  final VoidCallback onNotify;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final ink = dark ? Colors.white : AppTheme.navy;
    final paused = ref.watch(appearanceProvider).notificationsPaused;
    return SizedBox(
      height: 52,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Row(
          children: [
            SizedBox(
              width: 48,
              child: _HeaderIcon(
                icon: AppIcons.search,
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
                icon: paused ? AppIcons.bellOff : AppIcons.bell,
                tooltip: paused ? 'Notifications en pause' : 'Notifications',
                color: ink,
                onTap: onNotify,
                badge: paused
                    ? 0
                    : ref.watch(unreadNotificationsProvider).valueOrNull ?? 0,
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
    this.badge = 0,
  });

  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onTap,
      tooltip: tooltip,
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          Icon(icon, size: 24),
          if (badge > 0)
            Positioned(
              right: -6,
              top: -4,
              child: UnreadBadge(count: badge, size: 16),
            ),
        ],
      ),
      color: color,
      style: IconButton.styleFrom(
        minimumSize: const Size(44, 44),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}
