import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../core/constants.dart';
import 'play_badge.dart';

class Cover extends StatelessWidget {
  const Cover({
    super.key,
    required this.url,
    this.play = false,
    this.height,
    this.radius = 14,
    this.headers,
  });

  final String? url;
  final bool play;
  final double? height;
  final double radius;
  final Map<String, String>? headers;

  @override
  Widget build(BuildContext context) {
    final image = url == null || url!.isEmpty
        ? Container(color: const Color(kBrandNavy))
        : CachedNetworkImage(
            imageUrl: url!,
            httpHeaders: headers,
            fit: BoxFit.cover,
            width: double.infinity,
            height: height,
            placeholder: (_, _) =>
                Container(color: const Color(0xFF1A3A5C)),
            errorWidget: (_, _, _) =>
                Container(color: const Color(kBrandNavy)),
          );

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: Stack(
          fit: StackFit.expand,
          children: [
            image,
            if (play) const PlayBadge(),
          ],
        ),
      ),
    );
  }
}
