import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';

class AuthShell extends StatelessWidget {
  const AuthShell({
    super.key,
    required this.greeting,
    required this.subtitle,
    required this.cardTitle,
    required this.child,
    this.footer,
    this.tagline = 'Média et observatoire de l’éducation en RDC.',
  });

  final String greeting;
  final String subtitle;
  final String cardTitle;
  final Widget child;
  final Widget? footer;
  final String? tagline;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bottomSafe = MediaQuery.viewPaddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppTheme.navy,
        resizeToAvoidBottomInset: true,
        body: Stack(
          fit: StackFit.expand,
          children: [
            const _AuthBackdrop(),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: SafeArea(
                    bottom: false,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final showCopy = constraints.maxHeight > 148;
                        return Padding(
                          padding: const EdgeInsets.fromLTRB(20, 4, 24, 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const _AuthBack(),
                              if (showCopy) ...[
                                const Spacer(),
                                Text(
                                  greeting,
                                  style: AppTheme.displayText(
                                    size: 34,
                                    weight: FontWeight.w800,
                                    height: 1.1,
                                    letterSpacing: -0.5,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  subtitle,
                                  style: AppTheme.sansText(
                                    size: 14,
                                    height: 1.4,
                                    color: Colors.white.withValues(alpha: 0.92),
                                  ),
                                ),
                              ] else
                                const Spacer(),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ),
                AnimatedSize(
                  duration: const Duration(milliseconds: 280),
                  curve: Curves.easeOutCubic,
                  alignment: Alignment.topCenter,
                  child: Material(
                    color: scheme.surface,
                    elevation: 0,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(40),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(24, 28, 24, 20 + bottomSafe),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            cardTitle,
                            style: AppTheme.displayText(
                              size: 24,
                              weight: FontWeight.w800,
                              color: scheme.onSurface,
                            ),
                          ),
                          const SizedBox(height: 22),
                          child,
                          if (footer != null) ...[
                            const SizedBox(height: 22),
                            footer!,
                          ],
                          if (tagline != null && tagline!.isNotEmpty) ...[
                            const SizedBox(height: 24),
                            Text(
                              tagline!,
                              textAlign: TextAlign.center,
                              style: AppTheme.sansText(
                                size: 12,
                                height: 1.4,
                                color: scheme.onSurface.withValues(alpha: 0.45),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthBackdrop extends StatelessWidget {
  const _AuthBackdrop();

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/onboarding/1.jpg',
          fit: BoxFit.cover,
          alignment: const Alignment(0, -0.25),
        ),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xB80565AB), Color(0xCC0565AB), Color(0xE600132B)],
              stops: [0, 0.55, 1],
            ),
          ),
        ),
      ],
    );
  }
}

class _AuthBack extends StatelessWidget {
  const _AuthBack();

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: () {
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/compte');
        }
      },
      tooltip: 'Retour',
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
      icon: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 24),
    );
  }
}

class AuthGlassField extends StatelessWidget {
  const AuthGlassField({
    super.key,
    required this.controller,
    required this.hint,
    required this.icon,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.onSubmitted,
    this.suffix,
    this.textCapitalization = TextCapitalization.none,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onSubmitted;
  final Widget? suffix;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final fill = dark
        ? Colors.white.withValues(alpha: 0.08)
        : const Color(0xFFF3F5F7);
    final muted = scheme.onSurface.withValues(alpha: 0.45);

    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      autofillHints: autofillHints,
      onSubmitted: onSubmitted,
      textCapitalization: textCapitalization,
      style: AppTheme.sansText(
        size: 15,
        weight: FontWeight.w600,
        color: scheme.onSurface,
      ),
      cursorColor: AppTheme.gold,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppTheme.sansText(size: 15, color: muted),
        prefixIcon: Icon(icon, color: muted),
        suffixIcon: suffix,
        filled: true,
        fillColor: fill,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(
            color: AppTheme.blue.withValues(alpha: 0.45),
            width: 1.5,
          ),
        ),
      ),
    );
  }
}

class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final bg = dark ? AppTheme.gold : AppTheme.navy;
    final fg = dark ? AppTheme.navy : Colors.white;

    return SizedBox(
      width: double.infinity,
      height: 54,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: bg,
          foregroundColor: fg,
          disabledBackgroundColor: bg.withValues(alpha: 0.45),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
        ),
        child: busy
            ? SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: fg),
              )
            : Text(
                label,
                style: AppTheme.sansText(
                  size: 16,
                  weight: FontWeight.w800,
                  color: fg,
                ),
              ),
      ),
    );
  }
}

class AuthErrorBanner extends StatelessWidget {
  const AuthErrorBanner(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppTheme.red.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Text(
          message,
          style: AppTheme.sansText(
            size: 13,
            weight: FontWeight.w600,
            height: 1.35,
            color: AppTheme.red,
          ),
        ),
      ),
    );
  }
}

class AuthNotice extends StatelessWidget {
  const AuthNotice(this.message, {super.key, this.color});

  final String message;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final ink = color ?? Theme.of(context).colorScheme.onSurface;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppTheme.gold.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Text(
          message,
          style: AppTheme.sansText(
            size: 13,
            weight: FontWeight.w600,
            height: 1.35,
            color: ink,
          ),
        ),
      ),
    );
  }
}
