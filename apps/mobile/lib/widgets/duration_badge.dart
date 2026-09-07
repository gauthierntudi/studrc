import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class DurationBadge extends StatelessWidget {
  const DurationBadge(this.label, {super.key, this.compact = false});

  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (label.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 5 : 6,
        vertical: compact ? 1.5 : 2,
      ),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: AppTheme.sansText(
          size: compact ? 10 : 11,
          weight: FontWeight.w700,
          height: 1.1,
          color: Colors.white,
        ),
      ),
    );
  }
}
