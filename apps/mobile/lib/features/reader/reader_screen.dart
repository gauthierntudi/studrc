import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/models.dart';

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

  @override
  void initState() {
    super.initState();
    _load();
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

    return Scaffold(
      appBar: AppBar(
        title: Text(session?.title ?? meta.valueOrNull?.title ?? 'Magazine'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : session == null
                  ? const Center(child: Text('Lecture indisponible'))
                  : session.pages.isEmpty
                      ? _Locked(session: session, magazineId: widget.magazineId)
                      : Column(
                          children: [
                            if (session.preview)
                              MaterialBanner(
                                content: Text(
                                  session.message ??
                                      'Aperçu — ${session.maxPages ?? 15} pages.',
                                ),
                                actions: [
                                  if (meta.valueOrNull?.accessType != 'FREE')
                                    TextButton(
                                      onPressed: () => context
                                          .push('/acheter/${widget.magazineId}'),
                                      child: const Text('Acheter'),
                                    )
                                  else
                                    TextButton(
                                      onPressed: () =>
                                          context.push('/connexion'),
                                      child: const Text('Connexion'),
                                    ),
                                ],
                              ),
                            Expanded(
                              child: PageView.builder(
                                itemCount: session.pages.length,
                                itemBuilder: (context, i) {
                                  final page = session.pages[i];
                                  return InteractiveViewer(
                                    child: CachedNetworkImage(
                                      imageUrl: page.url,
                                      httpHeaders: _headers,
                                      fit: BoxFit.contain,
                                      placeholder: (_, _) => const Center(
                                        child: CircularProgressIndicator(),
                                      ),
                                      errorWidget: (_, _, _) => const Center(
                                        child: Icon(Icons.broken_image),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
    );
  }
}

class _Locked extends StatelessWidget {
  const _Locked({required this.session, required this.magazineId});
  final MagazineSession session;
  final String magazineId;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              session.message ??
                  'Connectez-vous ou achetez ce numéro pour le lire.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => context.push('/acheter/$magazineId'),
              child: const Text('Acheter ce numéro'),
            ),
            TextButton(
              onPressed: () => context.push('/connexion'),
              child: const Text('Se connecter'),
            ),
          ],
        ),
      ),
    );
  }
}
