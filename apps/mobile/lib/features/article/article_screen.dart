import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';
import 'package:intl/intl.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/cover.dart';

final articleProvider = FutureProvider.family((ref, String slug) {
  return ref.watch(apiClientProvider).article(slug);
});

class ArticleScreen extends ConsumerWidget {
  const ArticleScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(articleProvider(slug));
    return Scaffold(
      appBar: AppBar(title: const Text('Article')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text(ref.read(apiClientProvider).apiError(e)),
        ),
        data: (article) => _ArticleBody(article: article),
      ),
    );
  }
}

class _ArticleBody extends StatelessWidget {
  const _ArticleBody({required this.article});
  final ArticleDetail article;

  @override
  Widget build(BuildContext context) {
    final video = article.videoStatus == 'READY' &&
        (article.videoHlsUrl?.isNotEmpty ?? false);
    final date = article.publishedAt == null
        ? null
        : DateFormat('d MMMM y', 'fr').format(
            DateTime.tryParse(article.publishedAt!) ?? DateTime.now(),
          );

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: [
        if ((article.category ?? article.categoryLabel) != null)
          Text(
            (article.categoryLabel ?? article.category ?? '').toUpperCase(),
            style: TextStyle(
              color: AppTheme.toneColor(
                isVideoRubrique(article.category) ? 'gold' : 'red',
              ),
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        const SizedBox(height: 8),
        Text(
          article.title,
          style: const TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w800,
            height: 1.15,
          ),
        ),
        if (article.authorName != null || date != null) ...[
          const SizedBox(height: 8),
          Text(
            [article.authorName, date].whereType<String>().join(' · '),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
        if (article.excerpt != null && article.excerpt!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(
            article.excerpt!,
            style: const TextStyle(fontSize: 17, height: 1.45),
          ),
        ],
        const SizedBox(height: 16),
        if (video)
          _HlsPlayer(
            src: article.videoHlsUrl!,
            poster: article.videoPosterUrl ?? article.coverUrl,
          )
        else if (article.coverUrl != null)
          Cover(url: article.coverUrl, height: 220),
        const SizedBox(height: 20),
        if (article.blocks.isNotEmpty)
          ...article.blocks.map(
            (b) => Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (b.title != null && b.title!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        b.title!,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  if (b.coverUrl != null) ...[
                    Cover(url: b.coverUrl, height: 180, radius: 8),
                    const SizedBox(height: 10),
                  ],
                  HtmlWidget(b.content),
                ],
              ),
            ),
          )
        else if (article.content.isNotEmpty)
          HtmlWidget(article.content),
      ],
    );
  }
}

class _HlsPlayer extends StatefulWidget {
  const _HlsPlayer({required this.src, this.poster});
  final String src;
  final String? poster;

  @override
  State<_HlsPlayer> createState() => _HlsPlayerState();
}

class _HlsPlayerState extends State<_HlsPlayer> {
  late final Player _player = Player();
  late final VideoController _controller = VideoController(_player);

  @override
  void initState() {
    super.initState();
    _player.open(Media(widget.src));
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: Video(controller: _controller),
      ),
    );
  }
}
