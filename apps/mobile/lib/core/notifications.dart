import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api.dart';
import 'appearance.dart';
import 'models.dart';
import '../theme/app_theme.dart';

final notificationsProvider = FutureProvider<List<AppNotification>>((ref) {
  final user = ref.watch(sessionProvider);
  if (user == null || user.email.isEmpty) return const [];
  return ref.watch(apiClientProvider).notifications();
});

final unreadNotificationsProvider = FutureProvider<int>((ref) async {
  final user = ref.watch(sessionProvider);
  if (user == null || user.email.isEmpty) return 0;
  if (ref.watch(appearanceProvider).notificationsPaused) return 0;
  try {
    return await ref.watch(apiClientProvider).unreadCount();
  } catch (_) {
    return 0;
  }
});

class UnreadBadge extends StatelessWidget {
  const UnreadBadge({
    super.key,
    required this.count,
    this.size = 20,
  });

  final int count;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();
    final label = count > 9 ? '9+' : '$count';
    final wide = label.length > 1;
    return Semantics(
      label: '$count notifications non lues',
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minWidth: size,
          maxHeight: size,
          minHeight: size,
        ),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: AppTheme.red,
            borderRadius: BorderRadius.all(Radius.circular(99)),
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: wide ? 6 : 0),
            child: Center(
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: AppTheme.sansText(
                  size: 11,
                  weight: FontWeight.w800,
                  height: 1,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
