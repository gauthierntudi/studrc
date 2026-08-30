import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/models.dart';
import '../../widgets/cover.dart';

class PurchaseScreen extends ConsumerStatefulWidget {
  const PurchaseScreen({super.key, required this.magazineId});

  final String magazineId;

  @override
  ConsumerState<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends ConsumerState<PurchaseScreen> {
  MagazineCard? _magazine;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  String? _status;
  final _phone = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final mag = await ref.read(apiClientProvider).magazine(widget.magazineId);
      setState(() => _magazine = mag);
    } catch (e) {
      setState(() => _error = ref.read(apiClientProvider).apiError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _priceLabel {
    final mag = _magazine;
    if (mag?.priceCents == null) return '';
    final amount = (mag!.priceCents! / 100).toStringAsFixed(2);
    return '$amount ${mag.currency}';
  }

  Future<void> _payStripe() async {
    final api = ref.read(apiClientProvider);
    setState(() {
      _busy = true;
      _error = null;
      _status = null;
    });
    try {
      if (ref.read(sessionProvider) == null) {
        if (mounted) context.push('/connexion');
        return;
      }
      final created = await api.stripePurchase(widget.magazineId);
      final clientSecret = '${created['clientSecret'] ?? ''}';
      final publishable = created['publishableKey'] as String?;
      final paymentId = '${created['paymentId'] ?? ''}';
      if (clientSecret.isEmpty) {
        throw Exception('Paiement carte indisponible pour le moment.');
      }
      if (publishable != null && publishable.isNotEmpty) {
        Stripe.publishableKey = publishable;
        await Stripe.instance.applySettings();
      }
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'STUDRC',
          style: ThemeMode.system,
        ),
      );
      await Stripe.instance.presentPaymentSheet();
      if (paymentId.isNotEmpty) {
        await api.confirmStripe(paymentId: paymentId);
      }
      if (mounted) context.go('/magazine/${widget.magazineId}');
    } on StripeException catch (e) {
      setState(() => _error = e.error.localizedMessage ?? 'Paiement annulé');
    } catch (e) {
      setState(() => _error = api.apiError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _payFlexpaie() async {
    final api = ref.read(apiClientProvider);
    final phone = _phone.text.trim();
    if (phone.isEmpty) {
      setState(() => _error = 'Indiquez un numéro Mobile Money.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _status = 'Demande envoyée…';
    });
    try {
      if (ref.read(sessionProvider) == null) {
        if (mounted) context.push('/connexion');
        return;
      }
      final created = await api.flexpaiePurchase(
        magazineId: widget.magazineId,
        phone: phone,
      );
      final paymentId = '${created['paymentId'] ?? ''}';
      setState(() => _status = '${created['message'] ?? 'Validez le paiement sur votre téléphone.'}');
      if (paymentId.isEmpty) return;
      for (var i = 0; i < 20; i++) {
        await Future<void>.delayed(const Duration(seconds: 3));
        final status = await api.checkPayment(paymentId);
        final s = '${status['status'] ?? ''}'.toUpperCase();
        if (s == 'PAID' || s == 'SUCCEEDED' || s == 'SUCCESS') {
          if (mounted) context.go('/magazine/${widget.magazineId}');
          return;
        }
        if (s == 'FAILED' || s == 'CANCELED' || s == 'CANCELLED') {
          throw Exception('Paiement échoué');
        }
      }
      setState(() => _status = 'Paiement en attente. Vérifiez plus tard dans Mes achats.');
    } catch (e) {
      setState(() => _error = api.apiError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mag = _magazine;
    return Scaffold(
      appBar: AppBar(title: const Text('Acheter')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (mag != null) ...[
                  Center(
                    child: SizedBox(
                      width: 160,
                      height: 220,
                      child: Cover(url: mag.coverUrl),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    mag.title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (_priceLabel.isNotEmpty)
                    Text(
                      _priceLabel,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                ],
                if (_status != null) ...[
                  const SizedBox(height: 12),
                  Text(_status!, textAlign: TextAlign.center),
                ],
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _busy ? null : _payStripe,
                  child: const Text('Payer par carte'),
                ),
                const SizedBox(height: 20),
                const Text('Ou Mobile Money (FlexPaie)'),
                const SizedBox(height: 8),
                TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Numéro (ex. +243…)',
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: _busy ? null : _payFlexpaie,
                  child: const Text('Payer par Mobile Money'),
                ),
              ],
            ),
    );
  }
}
