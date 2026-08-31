import 'package:flutter/material.dart';

/// Official STUDRC lockup, white on a transparent background.
class StudrcLogo extends StatelessWidget {
  const StudrcLogo({
    super.key,
    this.height = 40,
    this.color = Colors.white,
  });

  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/brand/studrc-logo-white.png',
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      color: color,
      colorBlendMode: BlendMode.srcIn,
      semanticLabel: 'STUDRC',
    );
  }
}
