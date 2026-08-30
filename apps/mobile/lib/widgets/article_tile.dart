import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/constants.dart';
import '../core/models.dart';
import '../theme/app_theme.dart';
import 'cover.dart';

class ArticleTile extends StatelessWidget {
  const ArticleTile({super.key, required this.article, this.compact = false});

  final ArticleCard article;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final play = isVideoRubrique(article.category, article.categoryLabel);
    return InkWell(
      onTap: () => context.push('/article/${Uri.encodeComponent(article.slug)}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: compact ? 96 : 120,
              height: compact ? 64 : 80,
              child: Cover(
                url: article.coverUrl,
                play: play,
                radius: 8,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    article.categoryLabel.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.toneColor(article.categoryTone),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    article.title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      height: 1.25,
                    ),
                  ),
                  if (article.dateLabel.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      article.dateLabel,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class FeaturedCard extends StatelessWidget {
  const FeaturedCard({super.key, required this.article});

  final ArticleCard article;

  @override
  Widget build(BuildContext context) {
    final play = isVideoRubrique(article.category, article.categoryLabel);
    return GestureDetector(
      onTap: () => context.push('/article/${Uri.encodeComponent(article.slug)}'),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Stack(
          children: [
            Cover(url: article.coverUrl, play: play, height: 260, radius: 0),
            Positioned.fill(
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Color(0xEB080A0E)],
                  ),
                ),
              ),
            ),
            Positioned(
              left: 14,
              right: 14,
              bottom: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    color: AppTheme.toneColor(article.categoryTone),
                    child: Text(
                      article.categoryLabel.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    article.title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
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
