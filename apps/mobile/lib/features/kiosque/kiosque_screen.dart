import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';
import '../../widgets/cover.dart';
import '../../widgets/studrc_logo.dart';

final kiosqueProvider = FutureProvider((ref) {
  return ref.watch(apiClientProvider).magazines(take: 30);
});

class KiosqueScreen extends ConsumerWidget {
  const KiosqueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(kiosqueProvider);
    final featured = async.valueOrNull?.firstOrNull;
    final wash = _hexColor(featured?.bgColor) ?? AppTheme.navy;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: wash,
        body: async.when(
          loading: () => const _KiosqueLoading(),
          error: (e, _) => _KiosqueMessage(
            ref.read(apiClientProvider).apiError(e),
            onRetry: () => ref.invalidate(kiosqueProvider),
          ),
          data: (items) {
            if (items.isEmpty) {
              return const _KiosqueMessage('Aucun magazine publié.');
            }
            final hero = items.first;
            final others = items.skip(1).toList();
            return LayoutBuilder(
              builder: (context, constraints) {
                final heroH = constraints.maxHeight.isFinite
                    ? constraints.maxHeight
                    : MediaQuery.sizeOf(context).height;
                return RefreshIndicator(
                  color: AppTheme.gold,
                  backgroundColor: AppTheme.navy,
                  onRefresh: () async => ref.refresh(kiosqueProvider.future),
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    slivers: [
                      SliverToBoxAdapter(
                        child: SizedBox(
                          height: heroH,
                          child: _MagHero(magazine: hero, height: heroH),
                        ),
                      ),
                      if (others.isNotEmpty) ...[
                        const SliverToBoxAdapter(child: _OthersHeader()),
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
                          sliver: SliverGrid(
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  childAspectRatio: 0.62,
                                  crossAxisSpacing: 14,
                                  mainAxisSpacing: 20,
                                ),
                            delegate: SliverChildBuilderDelegate(
                              (context, i) =>
                                  _MagShelfCard(magazine: others[i]),
                              childCount: others.length,
                            ),
                          ),
                        ),
                      ] else
                        const SliverToBoxAdapter(child: SizedBox(height: 40)),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _MagHero extends StatelessWidget {
  const _MagHero({required this.magazine, required this.height});

  final MagazineCard magazine;
  final double height;

  @override
  Widget build(BuildContext context) {
    final issue = _issueLabel(magazine.issueNumber);
    final wash = _hexColor(magazine.bgColor) ?? AppTheme.navy;

    return GestureDetector(
      onTap: () => context.push('/magazine/${magazine.id}'),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Cover(url: magazine.coverUrl, height: height, radius: 0),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.38),
                  Colors.transparent,
                  wash.withValues(alpha: 0.15),
                  wash.withValues(alpha: 0.78),
                  wash,
                ],
                stops: const [0.0, 0.22, 0.48, 0.72, 0.92],
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const StudrcLogo(height: 20, color: Colors.white),
                  const Spacer(),
                  Text(
                    'Nouveau numéro',
                    style: AppTheme.sansText(
                      size: 11,
                      weight: FontWeight.w800,
                      letterSpacing: 1.4,
                      color: AppTheme.gold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    magazine.title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppTheme.displayText(
                      size: 30,
                      weight: FontWeight.w800,
                      height: 1.12,
                      letterSpacing: -0.5,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (issue != null) _Chip(issue, accent: true),
                      if (magazine.dateLabel.isNotEmpty)
                        _Chip(magazine.dateLabel),
                      if (magazine.isFree) const _Chip('Gratuit', accent: true),
                    ],
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton(
                      onPressed: () => context.push('/magazine/${magazine.id}'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.gold,
                        foregroundColor: AppTheme.navy,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(28),
                        ),
                      ),
                      child: Text(
                        magazine.isFree
                            ? 'Lire ce numéro'
                            : 'Feuilleter l’aperçu',
                        style: AppTheme.sansText(
                          size: 15,
                          weight: FontWeight.w800,
                          color: AppTheme.navy,
                        ),
                      ),
                    ),
                  ),
                  if (!magazine.isFree) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: OutlinedButton(
                        onPressed: () =>
                            context.push('/acheter/${magazine.id}'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(
                            color: Colors.white.withValues(alpha: 0.28),
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(28),
                          ),
                        ),
                        child: Text(
                          _priceLabel(magazine) ?? 'Acheter ce numéro',
                          style: AppTheme.sansText(
                            size: 14,
                            weight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OthersHeader extends StatelessWidget {
  const _OthersHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 32, 20, 14),
      child: Text(
        'Tous les numéros',
        style: AppTheme.displayText(
          size: 18,
          weight: FontWeight.w800,
          color: Colors.white,
        ),
      ),
    );
  }
}

class _MagShelfCard extends StatelessWidget {
  const _MagShelfCard({required this.magazine});

  final MagazineCard magazine;

  @override
  Widget build(BuildContext context) {
    final issue = _issueLabel(magazine.issueNumber);
    return GestureDetector(
      onTap: () => context.push('/magazine/${magazine.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.38),
                    blurRadius: 18,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Cover(url: magazine.coverUrl, radius: 8),
                  if (issue != null)
                    Positioned(
                      left: 8,
                      bottom: 8,
                      child: _MiniBadge(issue, AppTheme.navy, Colors.white),
                    ),
                  if (magazine.isFree)
                    const Positioned(
                      right: 8,
                      top: 8,
                      child: _MiniBadge(
                        'Gratuit',
                        AppTheme.gold,
                        AppTheme.navy,
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            magazine.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTheme.displayText(
              size: 13,
              weight: FontWeight.w700,
              height: 1.25,
              color: Colors.white,
            ),
          ),
          if (magazine.dateLabel.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              magazine.dateLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.sansText(
                size: 11,
                weight: FontWeight.w600,
                color: Colors.white.withValues(alpha: 0.5),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label, {this.accent = false});

  final String label;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: accent
            ? AppTheme.gold.withValues(alpha: 0.18)
            : Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(
          color: accent
              ? AppTheme.gold.withValues(alpha: 0.45)
              : Colors.white.withValues(alpha: 0.12),
        ),
      ),
      child: Text(
        label,
        style: AppTheme.sansText(
          size: 12,
          weight: FontWeight.w700,
          color: accent ? AppTheme.gold : Colors.white,
        ),
      ),
    );
  }
}

class _MiniBadge extends StatelessWidget {
  const _MiniBadge(this.label, this.bg, this.ink);

  final String label;
  final Color bg;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: AppTheme.sansText(
          size: 10,
          weight: FontWeight.w800,
          height: 1.1,
          color: ink,
        ),
      ),
    );
  }
}

class _KiosqueLoading extends StatelessWidget {
  const _KiosqueLoading();

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator(color: AppTheme.gold));
  }
}

class _KiosqueMessage extends StatelessWidget {
  const _KiosqueMessage(this.text, {this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              text,
              textAlign: TextAlign.center,
              style: AppTheme.sansText(size: 15, color: Colors.white70),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              TextButton(onPressed: onRetry, child: const Text('Réessayer')),
            ],
          ],
        ),
      ),
    );
  }
}

Color? _hexColor(String? value) {
  if (value == null) return null;
  var hex = value.trim();
  if (hex.startsWith('#')) hex = hex.substring(1);
  if (hex.length == 3) {
    hex = hex.split('').map((c) => '$c$c').join();
  }
  if (hex.length != 6) return null;
  final n = int.tryParse(hex, radix: 16);
  if (n == null) return null;
  return Color(0xFF000000 | n);
}

String? _issueLabel(String? value) {
  if (value == null) return null;
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  if (trimmed.startsWith('#') || trimmed.toLowerCase().startsWith('n')) {
    return trimmed;
  }
  return '#$trimmed';
}

String? _priceLabel(MagazineCard mag) {
  if (mag.priceCents == null) return 'Acheter ce numéro';
  final amount = (mag.priceCents! / 100).toStringAsFixed(2);
  return 'Acheter · $amount ${mag.currency}';
}
