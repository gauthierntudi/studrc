import 'dart:async';
import 'dart:convert';
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
    _api.onAuthCleared = () {
      if (mounted) state = null;
    };
    restore();
  }

  final ApiClient _api;
  int _epoch = 0;

  bool _isAlive(Subscriber? user) =>
      user != null && user.id.isNotEmpty && user.id != 'null' && user.email.isNotEmpty;

  Future<void> restore() async {
    final epoch = _epoch;
    try {
      final user = await _api.me();
      if (epoch != _epoch) return;
      state = _isAlive(user) ? user : null;
    } catch (_) {
      if (epoch != _epoch) return;
    }
  }

  Future<void> login(String email, String password, {String? turnstile}) async {
    _epoch++;
    state = await _api.login(email, password, turnstileToken: turnstile);
  }

  Future<void> loginWithGoogle(String credential, {String? turnstile}) async {
    _epoch++;
    state = await _api.loginWithGoogle(
      credential,
      turnstileToken: turnstile,
    );
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    String? phone,
    String? turnstile,
  }) async {
    _epoch++;
    state = await _api.register(
      name: name,
      email: email,
      password: password,
      phone: phone,
      turnstileToken: turnstile,
    );
  }

  Future<void> logout() async {
    _epoch++;
    await _api.logout();
    state = null;
  }

  Future<void> deleteAccount() async {
    _epoch++;
    await _api.deleteAccount();
    state = null;
  }

  Future<void> refreshMe() async {
    final epoch = _epoch;
    final user = await _api.me();
    if (epoch != _epoch) return;
    state = _isAlive(user) ? user : null;
  }

  Future<void> uploadAvatar(String filePath) async {
    state = await _api.uploadAvatar(filePath);
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
    _refreshDio = Dio(
      BaseOptions(
        baseUrl: kApiBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        headers: const {'Accept': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (_isAuthPublicPath(options.path)) {
            options.headers.remove('Authorization');
            return handler.next(options);
          }
          await _ensureFreshAccess();
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
              !_isAuthPublicPath(req.path) &&
              req.data is! FormData) {
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
              } catch (_) {
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
  late final Dio _refreshDio;
  Future<bool>? _refreshing;
  void Function()? onAuthCleared;

  bool _isAuthPublicPath(String path) {
    return path.contains('/auth/refresh') ||
        path.contains('/auth/login') ||
        path.contains('/auth/google') ||
        path.contains('/auth/register') ||
        path.contains('/auth/forgot-password') ||
        path.contains('/auth/reset-password') ||
        path.contains('/auth/verify-email');
  }

  Future<Map<String, String>> bearerHeaders() async {
    final token = await _store.accessToken;
    if (token == null || token.isEmpty) return const {};
    return {'Authorization': 'Bearer $token'};
  }

  Future<bool> _refresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refresh = await _store.refreshToken;
    if (refresh == null || refresh.isEmpty) {
      await _forgetAuth();
      return false;
    }
    try {
      final res = await _refreshDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refresh},
      );
      final data = res.data;
      if (data == null || data['accessToken'] == null) {
        await _forgetAuth();
        return false;
      }
      await _store.save(
        accessToken: '${data['accessToken']}',
        refreshToken: '${data['refreshToken'] ?? refresh}',
      );
      return true;
    } catch (_) {
      await _forgetAuth();
      return false;
    }
  }

  Future<void> _forgetAuth() async {
    await _store.clear();
    onAuthCleared?.call();
  }

  Future<void> _ensureFreshAccess() async {
    final token = await _store.accessToken;
    if (!_accessExpiringSoon(token)) return;
    final refresh = await _store.refreshToken;
    if (refresh == null || refresh.isEmpty) return;
    await _refresh();
  }

  bool _accessExpiringSoon(String? token) {
    if (token == null || token.isEmpty) return true;
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      );
      if (payload is! Map) return true;
      final exp = payload['exp'];
      if (exp is! num) return true;
      final now = DateTime.now().toUtc().millisecondsSinceEpoch / 1000;
      return now > exp - 60;
    } catch (_) {
      return true;
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
        googleClientId: kGoogleServerClientId,
        googleIosClientId: kGoogleIosClientId,
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

  Future<List<StatusItem>> statuses() => _get(
        '/statuses',
        parse: (d) {
          final items = _map(d)['items'];
          if (items is! List) return const <StatusItem>[];
          return [
            for (final e in items)
              if (e is Map) StatusItem.fromJson(Map<String, dynamic>.from(e)),
          ];
        },
      );

  Future<void> markStatusViewed(String id) async {
    try {
      await _dio.post('/statuses/${Uri.encodeComponent(id)}/view');
    } catch (_) {}
  }

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

  Future<Subscriber> loginWithGoogle(
    String credential, {
    String? turnstileToken,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/google',
      data: {
        'credential': credential,
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
    Future<Subscriber?> read() async {
      final token = await _store.accessToken;
      if (token == null || token.isEmpty) return null;
      final res = await _dio.get<dynamic>('/auth/me');
      return _subscriberOrNull(res.data);
    }

    final current = await read();
    if (current != null) return current;

    final refresh = await _store.refreshToken;
    if (refresh == null || refresh.isEmpty) return null;
    if (await _refresh()) return read();
    return null;
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

  Future<Subscriber> uploadAvatar(String filePath) async {
    await _ensureFreshAccess();
    try {
      return await _postAvatar(filePath);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401 && await _refresh()) {
        return _postAvatar(filePath);
      }
      rethrow;
    }
  }

  Future<Subscriber> _postAvatar(String filePath) async {
    final lower = filePath.toLowerCase();
    final png = lower.endsWith('.png');
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        filePath,
        filename: png ? 'avatar.png' : 'avatar.jpg',
        contentType: DioMediaType('image', png ? 'png' : 'jpeg'),
      ),
    });
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/me/avatar',
      data: form,
    );
    final user = _subscriberOrNull(res.data);
    if (user == null) {
      throw Exception('Réponse profil invalide');
    }
    return user;
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

  /// Supprime définitivement le compte connecté, puis vide la session locale.
  Future<void> deleteAccount() async {
    await _dio.delete('/auth/me');
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

  Future<List<AppNotification>> notifications({
    int days = 7,
    int take = 50,
    int skip = 0,
  }) =>
      _get(
        '/library/notifications',
        query: {'days': days, 'take': take, 'skip': skip},
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

  Future<int> unreadCount({int days = 7}) => _get(
        '/library/notifications/unread-count',
        query: {'days': days},
        parse: (d) {
          if (d is num) return d.toInt();
          final m = _map(d);
          return (m['unreadCount'] as num?)?.toInt() ??
              (m['count'] as num?)?.toInt() ??
              (m['unread'] as num?)?.toInt() ??
              0;
        },
      );

  Future<int> markNotificationRead(String id) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/library/notifications/read',
      data: {'notificationId': id},
    );
    final m = _map(res.data);
    return (m['unreadCount'] as num?)?.toInt() ?? 0;
  }

  Future<void> markNotificationsSeen({int days = 7}) async {
    await _dio.post(
      '/library/notifications/seen',
      queryParameters: {'days': days},
    );
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

  Subscriber? _subscriberOrNull(dynamic data) {
    if (data == null) return null;
    final map = _map(data);
    if (map.isEmpty) return null;
    final raw = map['user'] is Map
        ? Map<String, dynamic>.from(map['user'] as Map)
        : map;
    final user = Subscriber.fromJson(raw);
    if (user.id.isEmpty || user.id == 'null' || user.email.isEmpty) {
      return null;
    }
    return user;
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
