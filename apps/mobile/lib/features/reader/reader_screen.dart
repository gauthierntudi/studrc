import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:studrc/widgets/app_icons.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../core/models.dart';
import '../../theme/app_theme.dart';

final magazineMetaProvider = FutureProvider.family((ref, String id) {
  return ref.watch(apiClientProvider).magazine(id);
});

class ReaderScreen extends ConsumerStatefulWidget {
  const ReaderScreen({super.key, required this.magazineId});

  final String magazineId;

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen> {
  MagazineSession? _session;
  String? _error;
  bool _loading = true;
  Map<String, String> _headers = const {};
  final _pages = PageController();
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final api = ref.read(apiClientProvider);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _headers = await api.bearerHeaders();
      MagazineSession session;
      try {
        session = await api.readMagazine(widget.magazineId);
      } catch (_) {
        session = await api.previewMagazine(widget.magazineId);
      }
      setState(() => _session = session);
    } catch (e) {
      setState(() => _error = api.apiError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final meta = ref.watch(magazineMetaProvider(widget.magazineId));
    final session = _session;
    final title = session?.title ?? meta.valueOrNull?.title ?? 'STU MAG';
    final pages = session?.pages ?? const <MagazinePage>[];
    final pageLabel = pages.isEmpty ? '' : '${_index + 1} / ${pages.length}';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppTheme.navy,
        appBar: AppBar(
          backgroundColor: AppTheme.navy,
          foregroundColor: Colors.white,
          title: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTheme.displayText(
              size: 16,
              weight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          actions: [
            if (pageLabel.isNotEmpty)
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: Text(
                    pageLabel,
                    style: AppTheme.sansText(
                      size: 12,
                      weight: FontWeight.w700,
                      color: Colors.white.withValues(alpha: 0.7),
                    ),
                  ),
                ),
              ),
          ],
        ),
        body: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppTheme.gold),
              )
            : _error != null
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: AppTheme.sansText(color: Colors.white70),
                  ),
                ),
              )
            : session == null
            ? Center(
                child: Text(
                  'Lecture indisponible',
                  style: AppTheme.sansText(color: Colors.white70),
                ),
              )
            : session.pages.isEmpty
            ? _Locked(session: session, magazineId: widget.magazineId)
            : Column(
                children: [
                  Expanded(
                    child: PageView.builder(
                      controller: _pages,
                      itemCount: session.pages.length,
                      onPageChanged: (i) => setState(() => _index = i),
                      itemBuilder: (context, i) {
                        final page = session.pages[i];
                        return InteractiveViewer(
                          child: CachedNetworkImage(
                            imageUrl: page.url,
                            httpHeaders: _headers,
                            fit: BoxFit.contain,
                            placeholder: (_, _) => const Center(
                              child: CircularProgressIndicator(
                                color: AppTheme.gold,
                              ),
                            ),
                            errorWidget: (_, _, _) => const Center(
                              child: Icon(
                                AppIcons.imageOff,
                                color: Colors.white54,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  if (session.preview)
                    _PreviewBar(
                      session: session,
                      magazineId: widget.magazineId,
                      isFree: meta.valueOrNull?.isFree ?? false,
                    ),
                ],
              ),
      ),
    );
  }
}

class _PreviewBar extends ConsumerWidget {
  const _PreviewBar({
    required this.session,
    required this.magazineId,
    required this.isFree,
  });

  final MagazineSession session;
  final String magazineId;
  final bool isFree;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(sessionProvider)?.email.isNotEmpty ?? false;
    // Sans achat in-app, seul le bouton de connexion reste utile.
    final toLogin = isFree || !kInAppPurchases;
    final showButton = kInAppPurchases || !signedIn;
    return SafeArea(
      top: false,
      child: Material(
        color: const Color(0xFF0A2140),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  session.message ??
                      'Aperçu — ${session.maxPages ?? 15} premières pages.',
                  style: AppTheme.sansText(
                    size: 12,
                    height: 1.35,
                    color: Colors.white.withValues(alpha: 0.78),
                  ),
                ),
              ),
              if (showButton) ...[
                const SizedBox(width: 12),
                FilledButton(
                  onPressed: () => context.push(
                    toLogin ? '/connexion' : '/acheter/$magazineId',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.gold,
                    foregroundColor: AppTheme.navy,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    minimumSize: const Size(0, 40),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  child: Text(
                    toLogin ? 'Connexion' : 'Acheter',
                    style: AppTheme.sansText(
                      size: 13,
                      weight: FontWeight.w800,
                      color: AppTheme.navy,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Locked extends ConsumerWidget {
  const _Locked({required this.session, required this.magazineId});
  final MagazineSession session;
  final String magazineId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(sessionProvider)?.email.isNotEmpty ?? false;
    final String message;
    if (kInAppPurchases) {
      message =
          session.message ??
          'Connectez-vous ou achetez ce numéro pour le lire.';
    } else if (signedIn) {
      message = 'Ce numéro n’est pas disponible avec votre compte.';
    } else {
      message = 'Connectez-vous pour lire les numéros de votre compte.';
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(AppIcons.lock, color: AppTheme.gold, size: 36),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTheme.sansText(
                size: 15,
                height: 1.45,
                color: Colors.white.withValues(alpha: 0.82),
              ),
            ),
            if (kInAppPurchases) ...[
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: FilledButton(
                  onPressed: () => context.push('/acheter/$magazineId'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.gold,
                    foregroundColor: AppTheme.navy,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(28),
                    ),
                  ),
                  child: Text(
                    'Acheter ce numéro',
                    style: AppTheme.sansText(
                      size: 15,
                      weight: FontWeight.w800,
                      color: AppTheme.navy,
                    ),
                  ),
                ),
              ),
            ],
            if (!kInAppPurchases) const SizedBox(height: 12),
            if (kInAppPurchases || !signedIn)
              TextButton(
                onPressed: () => context.push('/connexion'),
                child: Text(
                  'Se connecter',
                  style: AppTheme.sansText(
                    size: 14,
                    weight: FontWeight.w700,
                    color: Colors.white70,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
