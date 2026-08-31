import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/constants.dart';
import '../core/models.dart';
import '../theme/app_theme.dart';
import 'cover.dart';

class ArticleTile extends StatelessWidget {
  const ArticleTile({
    super.key,
    required this.article,
    this.compact = false,
    this.showMeta = true,
  });

  final ArticleCard article;
  final bool compact;
  final bool showMeta;

  @override
  Widget build(BuildContext context) {
    final play = isVideoRubrique(article.category, article.categoryLabel);
    final scheme = Theme.of(context).colorScheme;
    final size = compact ? 72.0 : 88.0;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () =>
            context.push('/article/${Uri.encodeComponent(article.slug)}'),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: size,
                height: size,
                child: Cover(
                  url: article.coverUrl,
                  play: play,
                  radius: 16,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (showMeta && article.categoryLabel.isNotEmpty) ...[
                      Text(
                        capitalizeLabel(article.categoryLabel),
                        style: AppTheme.sansText(
                          size: 11,
                          weight: FontWeight.w700,
                          letterSpacing: 0,
                          color: AppTheme.toneColor(article.categoryTone),
                        ),
                      ),
                      const SizedBox(height: 4),
                    ],
                    Text(
                      article.title,
                      maxLines: showMeta ? 3 : 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.displayText(
                        size: compact ? 14 : 16,
                        weight: FontWeight.w700,
                        height: 1.3,
                        color: scheme.onSurface,
                      ),
                    ),
                    if (showMeta && article.dateLabel.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        article.dateLabel,
                        style: AppTheme.sansText(
                          size: 12,
                          color: scheme.onSurface.withValues(alpha: 0.55),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class FeaturedCard extends StatelessWidget {
  const FeaturedCard({super.key, required this.article, this.badge});

  final ArticleCard article;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final play = isVideoRubrique(article.category, article.categoryLabel);
    final tone = AppTheme.toneColor(article.categoryTone);
    final label = badge ??
        (article.categoryLabel.isNotEmpty
            ? capitalizeLabel(article.categoryLabel)
            : 'À la une');

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () =>
            context.push('/article/${Uri.encodeComponent(article.slug)}'),
        child: Stack(
          children: [
            Cover(
              url: article.coverUrl,
              play: play,
              height: 260,
              radius: 22,
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.05),
                      Colors.black.withValues(alpha: 0.15),
                      Colors.black.withValues(alpha: 0.78),
                    ],
                    stops: const [0.35, 0.55, 1],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: tone,
                      borderRadius: BorderRadius.circular(8),
                    ),
                      child: Text(
                        label,
                        style: AppTheme.sansText(
                          size: 11,
                          weight: FontWeight.w800,
                          letterSpacing: 0,
                          color: tone == AppTheme.gold
                              ? AppTheme.navy
                              : Colors.white,
                        ),
                      ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    article.title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.displayText(
                      size: 22,
                      weight: FontWeight.w800,
                      height: 1.2,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
