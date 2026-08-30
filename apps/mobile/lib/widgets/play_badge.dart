import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class PlayBadge extends StatelessWidget {
  const PlayBadge({super.key, this.size = 48});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: AppTheme.gold,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.28),
              blurRadius: 12,
            ),
          ],
        ),
        child: const Icon(Icons.play_arrow, color: Colors.black, size: 28),
      ),
    );
  }
}
