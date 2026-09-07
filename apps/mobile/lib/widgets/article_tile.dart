import 'package:flutter/material.dart';
import '../core/article_nav.dart';
import '../core/constants.dart';
import '../core/models.dart';
import '../theme/app_theme.dart';
import 'cover.dart';
import 'duration_badge.dart';

class ArticleTile extends StatelessWidget {
  const ArticleTile({
    super.key,
    required this.article,
    this.compact = false,
    this.showMeta = true,
    this.showExcerpt = false,
  });

  final ArticleCard article;
  final bool compact;
  final bool showMeta;
  final bool showExcerpt;

  @override
  Widget build(BuildContext context) {
    final video =
        isVideoRubrique(article.category, article.categoryLabel) ||
        article.hasReadyVideo;
    final clock = article.durationClock;
    final scheme = Theme.of(context).colorScheme;
    final thumbH = compact ? 72.0 : 88.0;
    final thumbW = thumbH * 4 / 3;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => openArticleCard(context, article),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: thumbW,
                height: thumbH,
                child: Cover(
                  url: article.videoPosterUrl ?? article.coverUrl,
                  play: video && clock.isEmpty,
                  duration: clock,
                  height: thumbH,
                  radius: 12,
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
                      maxLines: showExcerpt ? 2 : (showMeta ? 3 : 2),
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.displayText(
                        size: compact ? 14 : 16,
                        weight: FontWeight.w700,
                        height: 1.3,
                        color: scheme.onSurface,
                      ),
                    ),
                    if (showExcerpt && article.chapo.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        article.chapo,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.sansText(
                          size: compact ? 12 : 13,
                          height: 1.4,
                          color: scheme.onSurface.withValues(alpha: 0.58),
                        ),
                      ),
                    ],
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
  const FeaturedCard({
    super.key,
    required this.article,
    this.badge,
    this.showExcerpt = false,
  });

  final ArticleCard article;
  final String? badge;
  final bool showExcerpt;

  @override
  Widget build(BuildContext context) {
    final video =
        isVideoRubrique(article.category, article.categoryLabel) ||
        article.hasReadyVideo;
    final clock = article.durationClock;
    final tone = AppTheme.toneColor(article.categoryTone);
    final label =
        badge ??
        (article.categoryLabel.isNotEmpty
            ? capitalizeLabel(article.categoryLabel)
            : 'À la une');

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => openArticleCard(context, article),
        child: AspectRatio(
          aspectRatio: 4 / 3,
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Stack(
                fit: StackFit.expand,
                children: [
                  Cover(
                    url: article.videoPosterUrl ?? article.coverUrl,
                    play: video && clock.isEmpty,
                    height: constraints.maxHeight,
                    radius: 22,
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color(0x0D000000),
                          Color(0x26000000),
                          Color(0xC7000000),
                        ],
                        stops: [0.35, 0.55, 1],
                      ),
                    ),
                  ),
                  if (clock.isNotEmpty)
                    Positioned(
                      right: 14,
                      bottom: 14,
                      child: DurationBadge(clock),
                    ),
                  Positioned(
                    left: 16,
                    right: clock.isNotEmpty ? 72 : 16,
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
                          maxLines: showExcerpt ? 2 : 3,
                          overflow: TextOverflow.ellipsis,
                          style: AppTheme.displayText(
                            size: 22,
                            weight: FontWeight.w800,
                            height: 1.2,
                            color: Colors.white,
                          ),
                        ),
                        if (showExcerpt && article.chapo.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            article.chapo,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.sansText(
                              size: 13,
                              height: 1.35,
                              color: Colors.white.withValues(alpha: 0.88),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
