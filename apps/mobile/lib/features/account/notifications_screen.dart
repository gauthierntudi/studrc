import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:studrc/widgets/app_icons.dart';
import '../../core/api.dart';
import '../../core/appearance.dart';
import '../../core/models.dart';
import '../../core/notifications.dart';
import '../../theme/app_theme.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider);
    if (user == null || user.email.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(AppIcons.bell, size: 40, color: AppTheme.gold),
              const SizedBox(height: 16),
              Text(
                'Connectez-vous pour voir vos alertes',
                textAlign: TextAlign.center,
                style: AppTheme.sansText(
                  size: 16,
                  weight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => context.push('/connexion'),
                child: const Text('Se connecter'),
              ),
            ],
          ),
        ),
      );
    }

    final async = ref.watch(notificationsProvider);
    final unread = ref.watch(unreadNotificationsProvider).valueOrNull ?? 0;
    final paused = ref.watch(appearanceProvider).notificationsPaused;
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Notifications'),
            if (unread > 0) ...[
              const SizedBox(width: 8),
              UnreadBadge(count: unread),
            ],
          ],
        ),
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: () async {
                HapticFeedback.selectionClick();
                await ref.read(apiClientProvider).markNotificationsSeen();
                ref.invalidate(notificationsProvider);
                ref.invalidate(unreadNotificationsProvider);
              },
              child: Text(
                'Tout lu',
                style: AppTheme.sansText(
                  size: 14,
                  weight: FontWeight.w800,
                  color: AppTheme.gold,
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          if (paused)
            Material(
              color: AppTheme.gold.withValues(alpha: 0.16),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                child: Row(
                  children: [
                    const Icon(AppIcons.bellOff, size: 18, color: AppTheme.navy),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Notifications en pause',
                        style: AppTheme.sansText(
                          size: 13.5,
                          weight: FontWeight.w600,
                          color: AppTheme.navy,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () =>
                          ref.read(appearanceProvider).setNotificationsPaused(false),
                      child: const Text('Reprendre'),
                    ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        ref.read(apiClientProvider).apiError(e),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: () => ref.invalidate(notificationsProvider),
                        child: const Text('Réessayer'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            AppIcons.bell,
                            size: 40,
                            color: Theme.of(context)
                                .colorScheme
                                .onSurface
                                .withValues(alpha: 0.28),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'Aucune notification',
                            style: AppTheme.sansText(
                              size: 17,
                              weight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Les nouveaux articles, magazines et paiements apparaîtront ici.',
                            textAlign: TextAlign.center,
                            style: AppTheme.sansText(
                              size: 14,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }
                return RefreshIndicator(
                  color: AppTheme.gold,
                  onRefresh: () async {
                    ref.invalidate(notificationsProvider);
                    ref.invalidate(unreadNotificationsProvider);
                    await ref.read(notificationsProvider.future);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      return _NotificationCard(
                        item: items[i],
                        dark: dark,
                        onOpen: () => _openNotification(context, ref, items[i]),
                      );
                    },
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

Future<void> _openNotification(
  BuildContext context,
  WidgetRef ref,
  AppNotification item,
) async {
  HapticFeedback.selectionClick();
  if (item.unread && item.id.isNotEmpty) {
    try {
      await ref.read(apiClientProvider).markNotificationRead(item.id);
    } catch (_) {}
    ref.invalidate(notificationsProvider);
    ref.invalidate(unreadNotificationsProvider);
  }
  if (!context.mounted) return;
  final route = _routeFor(item);
  if (route != null) context.push(route);
}

String? _routeFor(AppNotification item) {
  final href = item.href?.trim() ?? '';
  if (href.startsWith('/article/')) {
    return href;
  }
  if (href.startsWith('/lecture/')) {
    final id = href.split('/').last;
    if (id.isNotEmpty) return '/magazine/$id';
  }
  switch (item.kind) {
    case 'MAGAZINE':
    case 'PURCHASE_READY':
      return '/kiosque';
    case 'PAYMENT_SUCCESS':
    case 'PAYMENT_FAILED':
      return '/achats';
    case 'SUBSCRIPTION_EXPIRING':
      return '/kiosque';
    default:
      return null;
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.item,
    required this.dark,
    required this.onOpen,
  });

  final AppNotification item;
  final bool dark;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final ink = Theme.of(context).colorScheme.onSurface;
    final muted = ink.withValues(alpha: 0.52);
    final card = dark ? const Color(0xFF0A2A4C) : Colors.white;
    final unreadBg = dark
        ? AppTheme.gold.withValues(alpha: 0.08)
        : const Color(0xFFFFF8E6);
    final meta = _kindMeta(item.kind);

    return Material(
      color: item.unread ? unreadBg : card,
      elevation: dark ? 0 : 1,
      shadowColor: Colors.black.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Leading(
                coverUrl: item.coverUrl,
                icon: meta.icon,
                accent: meta.color,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            meta.label,
                            style: AppTheme.sansText(
                              size: 11,
                              weight: FontWeight.w800,
                              letterSpacing: 0.3,
                              color: meta.color,
                            ),
                          ),
                        ),
                        Text(
                          _timeLabel(item.createdAt),
                          style: AppTheme.sansText(size: 11.5, color: muted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.sansText(
                        size: 15.5,
                        weight: item.unread ? FontWeight.w800 : FontWeight.w600,
                        height: 1.3,
                        color: ink,
                      ),
                    ),
                    if ((item.body ?? '').trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        item.body!.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.sansText(
                          size: 13,
                          height: 1.35,
                          color: muted,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (item.unread) ...[
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Container(
                    width: 9,
                    height: 9,
                    decoration: const BoxDecoration(
                      color: AppTheme.gold,
                      shape: BoxShape.circle,
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

class _Leading extends StatelessWidget {
  const _Leading({
    required this.coverUrl,
    required this.icon,
    required this.accent,
  });

  final String? coverUrl;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final url = coverUrl?.trim() ?? '';
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 48,
        height: 48,
        child: url.isEmpty
            ? ColoredBox(
                color: accent.withValues(alpha: 0.14),
                child: Icon(icon, size: 22, color: accent),
              )
            : CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                errorWidget: (_, _, _) => ColoredBox(
                  color: accent.withValues(alpha: 0.14),
                  child: Icon(icon, size: 22, color: accent),
                ),
              ),
      ),
    );
  }
}

({String label, IconData icon, Color color}) _kindMeta(String kind) {
  switch (kind) {
    case 'ARTICLE':
      return (label: 'ARTICLE', icon: AppIcons.newspaper, color: AppTheme.blue);
    case 'MAGAZINE':
      return (label: 'MAGAZINE', icon: AppIcons.bookOpen, color: AppTheme.navy);
    case 'PAYMENT_SUCCESS':
      return (
        label: 'PAIEMENT',
        icon: AppIcons.circleCheck,
        color: const Color(0xFF1F8A4C),
      );
    case 'PAYMENT_FAILED':
      return (
        label: 'ÉCHEC',
        icon: AppIcons.triangleAlert,
        color: AppTheme.red,
      );
    case 'SUBSCRIPTION_EXPIRING':
      return (label: 'ABONNEMENT', icon: AppIcons.clock, color: AppTheme.gold);
    case 'PURCHASE_READY':
      return (
        label: 'ACHAT',
        icon: AppIcons.shoppingBag,
        color: const Color(0xFF1F8A4C),
      );
    default:
      return (label: 'ALERTE', icon: AppIcons.bell, color: AppTheme.gold);
  }
}

String _timeLabel(DateTime? at) {
  if (at == null) return '';
  final delta = DateTime.now().difference(at.toLocal());
  if (delta.inMinutes < 1) return 'À l’instant';
  if (delta.inMinutes < 60) return 'Il y a ${delta.inMinutes} min';
  if (delta.inHours < 24) return 'Il y a ${delta.inHours} h';
  if (delta.inDays < 7) return 'Il y a ${delta.inDays} j';
  final d = at.toLocal();
  return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';
}
