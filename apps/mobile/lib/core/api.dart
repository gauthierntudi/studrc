import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_store.dart';
import 'constants.dart';
import 'models.dart';

final authStoreProvider = Provider((_) => AuthStore());

final apiClientProvider = Provider((ref) {
  return ApiClient(ref.watch(authStoreProvider));
});

final appSettingsProvider = FutureProvider((ref) {
  return ref.watch(apiClientProvider).appSettings();
});

final sessionProvider = StateNotifierProvider<SessionController, Subscriber?>(
  (ref) => SessionController(ref.watch(apiClientProvider)),
);

class SessionController extends StateNotifier<Subscriber?> {
  SessionController(this._api) : super(null) {
    restore();
  }

  final ApiClient _api;

  Future<void> restore() async {
    try {
      state = await _api.me();
    } catch (_) {
      state = null;
    }
  }

  Future<void> login(String email, String password, {String? turnstile}) async {
    state = await _api.login(email, password, turnstileToken: turnstile);
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    String? phone,
    String? turnstile,
  }) async {
    state = await _api.register(
      name: name,
      email: email,
      password: password,
      phone: phone,
      turnstileToken: turnstile,
    );
  }

  Future<void> logout() async {
    await _api.logout();
    state = null;
  }

  Future<void> refreshMe() async {
    state = await _api.me();
  }
}

class ApiClient {
  ApiClient(this._store) {
    _dio = Dio(
      BaseOptions(
        baseUrl: kApiBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        headers: const {'Accept': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _store.accessToken;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final req = error.requestOptions;
          if (error.response?.statusCode == 401 &&
              req.extra['retried'] != true &&
              !req.path.contains('/auth/refresh') &&
              !req.path.contains('/auth/login')) {
            final ok = await _refresh();
            if (ok) {
              req.extra['retried'] = true;
              final token = await _store.accessToken;
              if (token != null) {
                req.headers['Authorization'] = 'Bearer $token';
              }
              try {
                final clone = await _dio.fetch(req);
                return handler.resolve(clone);
              } catch (e) {
                return handler.next(error);
              }
            }
          }
          handler.next(error);
        },
      ),
    );
  }

  final AuthStore _store;
  late final Dio _dio;

  Future<Map<String, String>> bearerHeaders() async {
    final token = await _store.accessToken;
    if (token == null || token.isEmpty) return const {};
    return {'Authorization': 'Bearer $token'};
  }

  Future<bool> _refresh() async {
    final refresh = await _store.refreshToken;
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refresh},
      );
      final data = res.data;
      if (data == null || data['accessToken'] == null) return false;
      await _store.save(
        accessToken: '${data['accessToken']}',
        refreshToken: '${data['refreshToken'] ?? refresh}',
      );
      return true;
    } catch (_) {
      await _store.clear();
      return false;
    }
  }

  Future<T> _get<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(dynamic data) parse,
  }) async {
    final res = await _dio.get<dynamic>(path, queryParameters: query);
    return parse(res.data);
  }

  Future<AppSettings> appSettings() async {
    try {
      return await _get(
        '/settings/app',
        parse: (d) => AppSettings.fromJson(_map(d)),
      );
    } catch (_) {
      return AppSettings(
        captcha: kTurnstileSiteKey.isNotEmpty,
        turnstileSiteKey: kTurnstileSiteKey,
      );
    }
  }

  Future<Subscriber> _saveSession(Map<String, dynamic> data) async {
    final session = AuthSession.fromJson(data);
    if (session.accessToken.isEmpty) {
      throw Exception(
        'L’API en ligne ne renvoie pas encore de jeton mobile. '
        'Déployez le correctif auth (accessToken / refreshToken) puis réessayez.',
      );
    }
    await _store.save(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    );
    return session.user;
  }

  Future<HomeFeed> home() =>
      _get('/articles/home', parse: (d) => HomeFeed.fromJson(_map(d)));

  Future<CategoryFeed> feed({int take = 12, int skip = 0}) => _get(
        '/articles/feed',
        query: {'take': take, 'skip': skip},
        parse: (d) => CategoryFeed.fromJson(_map(d)),
      );

  Future<CategoryFeed> byCategory(
    String slug, {
    int take = 12,
    int skip = 0,
  }) =>
      _get(
        '/articles/category/$slug',
        query: {'take': take, 'skip': skip},
        parse: (d) => CategoryFeed.fromJson(_map(d)),
      );

  Future<ArticleDetail> article(String slug) => _get(
        '/articles/${Uri.encodeComponent(slug)}',
        parse: (d) => ArticleDetail.fromJson(_map(d)),
      );

  Future<List<ArticleCard>> related(String slug, {int take = 12}) => _get(
        '/articles/related',
        query: {'slug': slug, 'take': take},
        parse: (d) {
          final items = _map(d)['items'] as List?;
          return items
                  ?.whereType<Map>()
                  .map((e) => ArticleCard.fromJson(Map<String, dynamic>.from(e)))
                  .toList() ??
              const <ArticleCard>[];
        },
      );

  Future<({List<ArticleCard> items, int total})> search(
    String q, {
    String? category,
    int take = 20,
    int skip = 0,
  }) =>
      _get(
        '/articles/search',
        query: {
          'q': q,
          'take': take,
          'skip': skip,
          if (category != null && category.isNotEmpty) 'category': category,
        },
        parse: (d) {
          final m = _map(d);
          final items = (m['items'] as List?)
                  ?.whereType<Map>()
                  .map((e) => ArticleCard.fromJson(Map<String, dynamic>.from(e)))
                  .toList() ??
              const <ArticleCard>[];
          return (items: items, total: (m['total'] as num?)?.toInt() ?? items.length);
        },
      );

  Future<Subscriber> login(
    String email,
    String password, {
    String? turnstileToken,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {
        'email': email,
        'password': password,
        if (turnstileToken case final token?) 'turnstileToken': token,
      },
    );
    return _saveSession(_map(res.data));
  }

  Future<Subscriber> register({
    required String name,
    required String email,
    required String password,
    String? phone,
    String? turnstileToken,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/register',
      data: {
        'name': name,
        'email': email,
        'password': password,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (turnstileToken case final token?) 'turnstileToken': token,
      },
    );
    return _saveSession(_map(res.data));
  }

  Future<Subscriber?> me() async {
    final token = await _store.accessToken;
    if (token == null) return null;
    final res = await _dio.get<dynamic>('/auth/me');
    if (res.data == null) return null;
    return Subscriber.fromJson(_map(res.data));
  }

  Future<Subscriber> updateProfile({
    required String name,
    required String email,
    String? phone,
  }) async {
    final res = await _dio.patch<Map<String, dynamic>>(
      '/auth/me',
      data: {
        'name': name,
        'email': email,
        if (phone case final p?) 'phone': p,
      },
    );
    return Subscriber.fromJson(_map(res.data));
  }

  Future<void> forgotPassword(String email, {String? turnstileToken}) async {
    await _dio.post(
      '/auth/forgot-password',
      data: {
        'email': email,
        if (turnstileToken case final token?) 'turnstileToken': token,
      },
    );
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {}
    await _store.clear();
  }

  Future<List<MagazineCard>> magazines({int take = 20, int skip = 0}) => _get(
        '/magazines',
        query: {'take': take, 'skip': skip},
        parse: (d) {
          final m = _map(d);
          return (m['items'] as List?)
                  ?.whereType<Map>()
                  .map((e) => MagazineCard.fromJson(Map<String, dynamic>.from(e)))
                  .toList() ??
              const [];
        },
      );

  Future<MagazineCard?> latestMagazine() async {
    final res = await _dio.get<dynamic>('/magazines/latest');
    if (res.data == null) return null;
    return MagazineCard.fromJson(_map(res.data));
  }

  Future<MagazineCard> magazine(String id) => _get(
        '/magazines/${Uri.encodeComponent(id)}',
        parse: (d) => MagazineCard.fromJson(_map(d)),
      );

  Future<MagazineSession> previewMagazine(String id) => _get(
        '/magazines/${Uri.encodeComponent(id)}/preview',
        parse: (d) => MagazineSession.fromJson(_map(d)),
      );

  Future<MagazineSession> readMagazine(String id) => _get(
        '/magazines/${Uri.encodeComponent(id)}/read',
        parse: (d) => MagazineSession.fromJson(_map(d)),
      );

  Future<List<AppNotification>> notifications() => _get(
        '/library/notifications',
        parse: (d) {
          final m = d is Map ? _map(d) : <String, dynamic>{};
          final items = m['items'] ?? m['notifications'] ?? (d is List ? d : []);
          if (items is! List) return const <AppNotification>[];
          return items
              .whereType<Map>()
              .map((e) => AppNotification.fromJson(Map<String, dynamic>.from(e)))
              .toList();
        },
      );

  Future<int> unreadCount() => _get(
        '/library/notifications/unread-count',
        parse: (d) {
          if (d is num) return d.toInt();
          final m = _map(d);
          return (m['count'] as num?)?.toInt() ??
              (m['unread'] as num?)?.toInt() ??
              0;
        },
      );

  Future<void> markNotificationRead(String id) async {
    await _dio.post('/library/notifications/read', data: {'notificationId': id});
  }

  Future<List<PurchaseItem>> purchases() => _get(
        '/library/purchases',
        parse: (d) {
          final m = d is Map ? _map(d) : <String, dynamic>{};
          final items = m['items'] ?? m['purchases'] ?? (d is List ? d : []);
          if (items is! List) return const <PurchaseItem>[];
          return items
              .whereType<Map>()
              .map((e) => PurchaseItem.fromJson(Map<String, dynamic>.from(e)))
              .toList();
        },
      );

  Future<Map<String, dynamic>> stripePurchase(String magazineId) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/payments/stripe/purchase',
      data: {'magazineId': magazineId},
    );
    return _map(res.data);
  }

  Future<void> confirmStripe({
    required String paymentId,
    String? paymentIntentId,
  }) async {
    await _dio.post(
      '/payments/stripe/confirm',
      data: {
        'paymentId': paymentId,
        if (paymentIntentId case final pi?) 'paymentIntentId': pi,
      },
    );
  }

  Future<Map<String, dynamic>> flexpaiePurchase({
    required String magazineId,
    required String phone,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/payments/flexpaie/purchase',
      data: {'magazineId': magazineId, 'phone': phone},
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> paymentStatus(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/payments/$id');
    return _map(res.data);
  }

  Future<Map<String, dynamic>> checkPayment(String id) async {
    final res = await _dio.post<Map<String, dynamic>>('/payments/$id/check');
    return _map(res.data);
  }

  Map<String, dynamic> _map(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  String apiError(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] != null) {
        final msg = data['message'];
        if (msg is List) return msg.join(' ');
        return '$msg';
      }
      return error.message ?? 'Erreur réseau';
    }
    return error.toString().replaceFirst('Exception: ', '');
  }
}
