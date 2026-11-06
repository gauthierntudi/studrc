import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:studrc/widgets/app_icons.dart';
import '../../core/api.dart';
import '../../theme/app_theme.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: _StudrcTabBar(
        index: navigationShell.currentIndex,
        onSelect: (i) {
          HapticFeedback.selectionClick();
          navigationShell.goBranch(
            i,
            initialLocation: i == navigationShell.currentIndex,
          );
        },
      ),
    );
  }
}

class _TabItem {
  const _TabItem({
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

const _tabs = <_TabItem>[
  _TabItem(
    icon: AppIcons.house,
    selectedIcon: AppIcons.house500,
    label: 'Accueil',
  ),
  _TabItem(
    icon: AppIcons.newspaper,
    selectedIcon: AppIcons.newspaper500,
    label: 'Actualités',
  ),
  _TabItem(
    icon: AppIcons.bookOpen,
    selectedIcon: AppIcons.bookOpen500,
    label: 'Kiosque',
  ),
  _TabItem(
    icon: AppIcons.userRound,
    selectedIcon: AppIcons.userRound500,
    label: 'Compte',
  ),
];

class _StudrcTabBar extends ConsumerWidget {
  const _StudrcTabBar({required this.index, required this.onSelect});

  final int index;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final bg = dark ? AppTheme.navy : Colors.white;
    final border = dark
        ? Colors.white.withValues(alpha: 0.08)
        : const Color(0xFFE6E8EC);

    return Material(
      color: bg,
      elevation: 0,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: bg,
          border: Border(top: BorderSide(color: border, width: 0.5)),
          boxShadow: dark
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 18,
                    offset: const Offset(0, -4),
                  ),
                ],
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 6, 4, 4),
            child: Row(
              children: [
                for (var i = 0; i < _tabs.length; i++)
                  Expanded(
                    child: _TabButton(
                      tab: _tabs[i],
                      selected: i == index,
                      onTap: () => onSelect(i),
                      active: dark ? AppTheme.gold : AppTheme.navy,
                      idle: scheme.onSurface.withValues(alpha: dark ? 0.48 : 0.42),
                      avatarUrl: i == 3
                          ? ref.watch(sessionProvider)?.avatarUrl
                          : null,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.tab,
    required this.selected,
    required this.onTap,
    required this.active,
    required this.idle,
    this.avatarUrl,
  });

  final _TabItem tab;
  final bool selected;
  final VoidCallback onTap;
  final Color active;
  final Color idle;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final color = selected ? active : idle;
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 180);
    final photo = avatarUrl?.trim() ?? '';

    return Semantics(
      button: true,
      selected: selected,
      label: tab.label,
      child: InkWell(
        onTap: onTap,
        customBorder: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedContainer(
                  duration: duration,
                  curve: Curves.easeOut,
                  width: selected ? 18 : 0,
                  height: 2.5,
                  margin: const EdgeInsets.only(bottom: 6),
                  decoration: BoxDecoration(
                    color: selected ? AppTheme.gold : Colors.transparent,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                if (photo.isNotEmpty)
                  AnimatedContainer(
                    duration: duration,
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: selected ? AppTheme.gold : Colors.transparent,
                        width: 1.5,
                      ),
                    ),
                    child: ClipOval(
                      child: CachedNetworkImage(
                        imageUrl: photo,
                        fit: BoxFit.cover,
                        width: 26,
                        height: 26,
                        errorWidget: (_, _, _) => Icon(
                          selected ? tab.selectedIcon : tab.icon,
                          size: 24,
                          color: color,
                        ),
                      ),
                    ),
                  )
                else
                  Icon(
                    selected ? tab.selectedIcon : tab.icon,
                    size: 24,
                    color: color,
                  ),
                const SizedBox(height: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    tab.label,
                    maxLines: 1,
                    style: AppTheme.sansText(
                      size: 11,
                      weight: selected ? FontWeight.w700 : FontWeight.w500,
                      height: 1.1,
                      letterSpacing: -0.1,
                      color: color,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
