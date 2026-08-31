import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/account/account_screen.dart';
import '../features/account/notifications_screen.dart';
import '../features/account/profile_screen.dart';
import '../features/account/purchases_screen.dart';
import '../features/article/article_screen.dart';
import '../features/auth/forgot_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/home/home_screen.dart';
import '../features/kiosque/kiosque_screen.dart';
import '../features/news/news_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/payments/purchase_screen.dart';
import '../features/reader/reader_screen.dart';
import '../features/rubrique/rubrique_screen.dart';
import '../features/search/search_screen.dart';
import '../features/shell/app_shell.dart';
import 'onboarding.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final onboarding = ref.read(onboardingProvider);
  return createAppRouter(onboarding);
});

GoRouter createAppRouter(OnboardingController onboarding) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: onboarding,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      if (!onboarding.completed && loc != '/onboarding') {
        return '/onboarding';
      }
      if (onboarding.completed && loc == '/onboarding') {
        return '/';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) =>
          AppShell(navigationShell: navigationShell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => const HomeScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/actualites',
              builder: (context, state) => const NewsScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/kiosque',
              builder: (context, state) => const KiosqueScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/compte',
              builder: (context, state) => const AccountScreen(),
            ),
          ],
        ),
      ],
    ),
    GoRoute(
      path: '/recherche',
      builder: (context, state) => const SearchScreen(),
    ),
    GoRoute(
      path: '/rubrique/:slug',
      builder: (context, state) =>
          RubriqueScreen(slug: state.pathParameters['slug']!),
    ),
    GoRoute(
      path: '/article/:slug',
      builder: (context, state) =>
          ArticleScreen(slug: state.pathParameters['slug']!),
    ),
    GoRoute(
      path: '/connexion',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/inscription',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/mot-de-passe-oublie',
      builder: (context, state) => const ForgotScreen(),
    ),
    GoRoute(
      path: '/profil',
      builder: (context, state) => const ProfileScreen(),
    ),
    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
    GoRoute(
      path: '/achats',
      builder: (context, state) => const PurchasesScreen(),
    ),
    GoRoute(
      path: '/magazine/:id',
      builder: (context, state) =>
          ReaderScreen(magazineId: state.pathParameters['id']!),
    ),
    GoRoute(
      path: '/acheter/:id',
      builder: (context, state) =>
          PurchaseScreen(magazineId: state.pathParameters['id']!),
    ),
    ],
  );
}
