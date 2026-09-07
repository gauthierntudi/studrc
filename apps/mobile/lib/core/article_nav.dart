import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'constants.dart';
import 'models.dart';

final _toneBySlug = <String, String>{};

void rememberArticleTone(String slug, String? tone) {
  final key = tone?.trim();
  if (key == null || key.isEmpty) return;
  _toneBySlug[slug] = key;
}

String? rememberedArticleTone(String slug) => _toneBySlug[slug];

String articleToneOf(ArticleCard article) {
  final tone = article.categoryTone.trim();
  if (tone.isNotEmpty) return tone;
  return toneFromCategory(article.category, article.categoryLabel);
}

void openArticle(
  BuildContext context, {
  required String slug,
  String? tone,
  String? category,
  String? categoryLabel,
  bool replace = false,
}) {
  if (isShortRubrique(category, categoryLabel)) {
    final path = '/shorts/${Uri.encodeComponent(slug)}';
    if (replace) {
      context.pushReplacement(path);
    } else {
      context.push(path);
    }
    return;
  }
  final resolved = (tone != null && tone.trim().isNotEmpty)
      ? tone.trim()
      : toneFromCategory(category, categoryLabel);
  rememberArticleTone(slug, resolved);
  final path = '/article/${Uri.encodeComponent(slug)}';
  if (replace) {
    context.pushReplacement(path, extra: resolved);
  } else {
    context.push(path, extra: resolved);
  }
}

void openArticleCard(
  BuildContext context,
  ArticleCard article, {
  bool replace = false,
}) {
  openArticle(
    context,
    slug: article.slug,
    tone: articleToneOf(article),
    category: article.category,
    categoryLabel: article.categoryLabel,
    replace: replace,
  );
}
