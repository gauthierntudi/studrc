import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/article_nav.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_icons.dart';
import '../../widgets/cover.dart';
import '../rubrique/rubrique_screen.dart';

/// Délai avant de lancer la recherche pendant la frappe.
const _debounce = Duration(milliseconds: 350);

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  Timer? _timer;
  int _requestId = 0;

  String _query = '';
  List<ArticleCard> _items = const [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Le clavier s’ouvre une fois la transition d’entrée terminée,
    // pour ne pas saccader l’animation.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final animation = ModalRoute.of(context)?.animation;
      void focusNow() {
        if (mounted && _controller.text.isEmpty) _focus.requestFocus();
      }

      if (animation == null || animation.isCompleted) {
        focusNow();
        return;
      }
      void listener(AnimationStatus status) {
        if (status != AnimationStatus.completed) return;
        animation.removeStatusListener(listener);
        focusNow();
      }

      animation.addStatusListener(listener);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() {}); // bouton effacer
    _timer?.cancel();
    final q = value.trim();
    if (q.isEmpty) {
      _requestId++;
      setState(() {
        _query = '';
        _items = const [];
        _loading = false;
        _error = null;
      });
      return;
    }
    if (q.length < 2) return;
    _timer = Timer(_debounce, () => _run(q));
  }

  Future<void> _run(String q) async {
    final id = ++_requestId;
    setState(() {
      _query = q;
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiClientProvider).search(q, take: 30);
      if (!mounted || id != _requestId) return;
      setState(() => _items = res.items);
    } catch (e) {
      if (!mounted || id != _requestId) return;
      setState(() => _error = ref.read(apiClientProvider).apiError(e));
    } finally {
      if (mounted && id == _requestId) setState(() => _loading = false);
    }
  }

  void _submit() {
    _timer?.cancel();
    final q = _controller.text.trim();
    // Valider ferme le clavier pour laisser voir les résultats.
    _focus.unfocus();
    if (q.isNotEmpty) _run(q);
  }

  void _clear() {
    _controller.clear();
    _onChanged('');
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final searching = _query.isNotEmpty;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _SearchBar(
              controller: _controller,
              focus: _focus,
              onChanged: _onChanged,
              onSubmit: _submit,
              onClear: _clear,
            ),
            Divider(height: 1, color: scheme.onSurface.withValues(alpha: 0.06)),
            Expanded(
              // Toucher le contenu (défiler, ouvrir un article) range le
              // clavier ; il ne revient pas au retour sur l’écran.
              child: Listener(
                behavior: HitTestBehavior.translucent,
                onPointerDown: (_) {
                  if (_focus.hasFocus) _focus.unfocus();
                },
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  child: searching
                      ? _Results(
                          key: const ValueKey('results'),
                          query: _query,
                          items: _items,
                          loading: _loading,
                          error: _error,
                          onRetry: () => _run(_query),
                        )
                      : const _Discover(key: ValueKey('discover')),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// --------------------------------------------------------------- barre

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.focus,
    required this.onChanged,
    required this.onSubmit,
    required this.onClear,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmit;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final hasText = controller.text.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 6, 8, 6),
      child: Row(
        children: [
          IconButton(
            onPressed: () {
              focus.unfocus();
              context.canPop() ? context.pop() : context.go('/');
            },
            tooltip: 'Retour',
            icon: const Icon(AppIcons.chevronLeft, size: 28),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focus,
              onChanged: onChanged,
              onSubmitted: (_) => onSubmit(),
              textInputAction: TextInputAction.search,
              textCapitalization: TextCapitalization.sentences,
              autocorrect: false,
              cursorColor: AppTheme.gold,
              style: AppTheme.sansText(
                size: 17,
                weight: FontWeight.w500,
                color: scheme.onSurface,
              ),
              decoration: InputDecoration(
                hintText: 'Rechercher un article…',
                hintStyle: AppTheme.sansText(
                  size: 17,
                  color: scheme.onSurface.withValues(alpha: 0.45),
                ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 150),
            child: hasText
                ? IconButton(
                    key: const ValueKey('clear'),
                    onPressed: onClear,
                    tooltip: 'Effacer',
                    icon: Icon(
                      AppIcons.x,
                      size: 22,
                      color: scheme.onSurface.withValues(alpha: 0.6),
                    ),
                  )
                : IconButton(
                    key: const ValueKey('search'),
                    onPressed: onSubmit,
                    tooltip: 'Rechercher',
                    icon: const Icon(AppIcons.search, size: 24),
                  ),
          ),
        ],
      ),
    );
  }
}

// ----------------------------------------------------------- découverte

class _Discover extends ConsumerWidget {
  const _Discover({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final all = ref.watch(rubriqueProvider(''));
    final recommended = all.valueOrNull == null
        ? const <ArticleCard>[]
        : (all.value!.mostRead.isNotEmpty
                  ? all.value!.mostRead
                  : all.value!.items)
              .take(8)
              .toList();

    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.only(top: 16, bottom: 32),
      children: [
        SizedBox(
          height: 176,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: kNewsRubriques.length + 1,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, i) => i == 0
                ? const _RubriqueCard(slug: '', label: 'Actualités', tone: 'red')
                : _RubriqueCard(
                    slug: kNewsRubriques[i - 1].slug,
                    label: kNewsRubriques[i - 1].label,
                    tone: kNewsRubriques[i - 1].tone,
                  ),
          ),
        ),
        const _Heading('Recommandés'),
        if (all.isLoading && recommended.isEmpty)
          const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (recommended.isNotEmpty)
          SizedBox(
            height: 300,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: recommended.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, i) =>
                  _RecommendedCard(article: recommended[i]),
            ),
          ),
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 14),
      child: Text(
        text,
        style: AppTheme.displayText(
          size: 24,
          weight: FontWeight.w800,
          color: Theme.of(context).colorScheme.onSurface,
        ),
      ),
    );
  }
}

/// Carte de rubrique : couverture du dernier article, avatar cerclé.
class _RubriqueCard extends ConsumerWidget {
  const _RubriqueCard({
    required this.slug,
    required this.label,
    required this.tone,
  });

  final String slug;
  final String label;
  final String tone;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(rubriqueProvider(slug)).valueOrNull;
    final lead = (feed?.items.isNotEmpty ?? false) ? feed!.items.first : null;
    final ring = AppTheme.toneColor(tone);

    return SizedBox(
      width: 112,
      child: Material(
        color: const Color(kBrandNavy),
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => slug.isEmpty
              ? context.go('/actualites')
              : context.push('/rubrique/$slug'),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (lead != null)
                Cover(
                  url: lead.videoPosterUrl ?? lead.coverUrl,
                  height: 176,
                  radius: 18,
                ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x00000000), Color(0xB3000000)],
                    stops: [0.45, 1],
                  ),
                ),
              ),
              Positioned(
                top: 10,
                left: 10,
                child: Container(
                  width: 38,
                  height: 38,
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: ring, width: 2.5),
                    color: Colors.black26,
                  ),
                  child: ClipOval(
                    child: (lead?.authorAvatarUrl?.isNotEmpty ?? false)
                        ? CachedNetworkImage(
                            imageUrl: lead!.authorAvatarUrl!,
                            fit: BoxFit.cover,
                          )
                        : Image.asset(
                            'assets/brand/studrc-mark.png',
                            fit: BoxFit.cover,
                          ),
                  ),
                ),
              ),
              Positioned(
                left: 10,
                right: 8,
                bottom: 10,
                child: Text(
                  capitalizeLabel(label),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.sansText(
                    size: 13,
                    weight: FontWeight.w800,
                    height: 1.2,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RecommendedCard extends StatelessWidget {
  const _RecommendedCard({required this.article});

  final ArticleCard article;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final video =
        isVideoRubrique(article.category, article.categoryLabel) ||
        article.hasReadyVideo;
    const width = 176.0;
    const coverH = 226.0;

    return SizedBox(
      width: width,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => openArticleCard(context, article),
          borderRadius: BorderRadius.circular(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Cover(
                url: article.videoPosterUrl ?? article.coverUrl,
                play: video && article.durationClock.isEmpty,
                duration: article.durationClock,
                height: coverH,
                radius: 22,
              ),
              const SizedBox(height: 10),
              Text(
                article.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTheme.displayText(
                  size: 15,
                  weight: FontWeight.w700,
                  height: 1.3,
                  color: scheme.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------- résultats

class _Results extends StatelessWidget {
  const _Results({
    super.key,
    required this.query,
    required this.items,
    required this.loading,
    required this.error,
    required this.onRetry,
  });

  final String query;
  final List<ArticleCard> items;
  final bool loading;
  final String? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = scheme.onSurface.withValues(alpha: 0.55);

    if (error != null && items.isEmpty) {
      return _Center(
        icon: AppIcons.wifiOff,
        text: error!,
        action: FilledButton(onPressed: onRetry, child: const Text('Réessayer')),
      );
    }
    if (items.isEmpty) {
      return loading
          ? const Center(child: CircularProgressIndicator())
          : _Center(
              icon: AppIcons.searchX,
              text: 'Aucun article ne correspond à « $query ».',
            );
    }

    return Stack(
      children: [
        ListView.separated(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
          itemCount: items.length + 1,
          separatorBuilder: (_, i) =>
              i == 0 ? const SizedBox.shrink() : const SizedBox(height: 4),
          itemBuilder: (context, i) {
            if (i == 0) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(4, 14, 4, 6),
                child: Text(
                  '${items.length} résultat${items.length > 1 ? 's' : ''}',
                  style: AppTheme.sansText(
                    size: 13,
                    weight: FontWeight.w600,
                    color: muted,
                  ),
                ),
              );
            }
            final a = items[i - 1];
            return ArticleListRow(
              article: a,
              tone: AppTheme.toneColor(articleToneOf(a)),
              showCategory: true,
            );
          },
        ),
        if (loading)
          const Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: LinearProgressIndicator(minHeight: 2),
          ),
      ],
    );
  }
}

class _Center extends StatelessWidget {
  const _Center({required this.icon, required this.text, this.action});

  final IconData icon;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurface.withValues(
          alpha: 0.55,
        );
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: muted),
            const SizedBox(height: 12),
            Text(
              text,
              textAlign: TextAlign.center,
              style: AppTheme.sansText(size: 15, height: 1.45, color: muted),
            ),
            if (action != null) ...[const SizedBox(height: 14), action!],
          ],
        ),
      ),
    );
  }
}
