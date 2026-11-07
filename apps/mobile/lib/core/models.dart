class ArticleCard {
  const ArticleCard({
    required this.id,
    required this.slug,
    required this.title,
    this.excerpt,
    this.coverUrl,
    this.category,
    this.categoryLabel = '',
    this.categoryTone = 'teal',
    this.authorName = 'STUDRC',
    this.dateLabel = '',
    this.videoHlsUrl,
    this.videoPosterUrl,
    this.videoStatus,
    this.videoDurationSec,
    this.authorAvatarUrl,
    this.publishedAt,
    this.viewCount = 0,
  });

  final String id;
  final String slug;
  final String title;
  final String? excerpt;
  final String? coverUrl;
  final String? category;
  final String categoryLabel;
  final String categoryTone;
  final String authorName;
  final String dateLabel;
  final String? videoHlsUrl;
  final String? videoPosterUrl;
  final String? videoStatus;
  final int? videoDurationSec;
  final String? authorAvatarUrl;
  final String? publishedAt;
  final int viewCount;

  bool get hasReadyVideo =>
      videoStatus == 'READY' && (videoHlsUrl?.isNotEmpty ?? false);

  String get durationLabel {
    final sec = videoDurationSec;
    if (sec == null || sec <= 0) return '';
    final minutes = (sec / 60).ceil().clamp(1, 9999);
    return '$minutes min';
  }

  String get durationClock {
    final sec = videoDurationSec;
    if (sec == null || sec <= 0) return '';
    final m = sec ~/ 60;
    final s = sec % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  /// Chapô brut, sans balises HTML.
  String get chapo {
    final raw = excerpt?.trim() ?? '';
    if (raw.isEmpty) return '';
    return raw
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll(RegExp(r'&nbsp;', caseSensitive: false), ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll(RegExp(r'&#39;|&apos;'), "'")
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  factory ArticleCard.fromJson(Map<String, dynamic> json) {
    return ArticleCard(
      id: '${json['id']}',
      slug: '${json['slug'] ?? json['id']}',
      title: '${json['title'] ?? ''}',
      excerpt: json['excerpt'] as String?,
      coverUrl: json['coverUrl'] as String?,
      category: json['category'] as String?,
      categoryLabel: '${json['categoryLabel'] ?? json['category'] ?? ''}',
      categoryTone: '${json['categoryTone'] ?? 'teal'}',
      authorName:
          '${json['authorName'] ?? json['author']?['name'] ?? 'STUDRC'}',
      dateLabel: '${json['dateLabel'] ?? ''}',
      videoHlsUrl: json['videoHlsUrl'] as String?,
      videoPosterUrl: json['videoPosterUrl'] as String?,
      videoStatus: json['videoStatus'] as String?,
      videoDurationSec: (json['videoDurationSec'] as num?)?.toInt(),
      authorAvatarUrl:
          (json['authorAvatarUrl'] ?? json['author']?['avatarUrl']) as String?,
      publishedAt: json['publishedAt'] as String?,
      viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class ArticleBlock {
  const ArticleBlock({this.title, this.coverUrl, required this.content});

  final String? title;
  final String? coverUrl;
  final String content;

  factory ArticleBlock.fromJson(Map<String, dynamic> json) {
    return ArticleBlock(
      title: json['title'] as String?,
      coverUrl: json['coverUrl'] as String?,
      content: '${json['content'] ?? ''}',
    );
  }
}

class ArticleDetail {
  const ArticleDetail({
    required this.id,
    required this.slug,
    required this.title,
    this.excerpt,
    this.coverUrl,
    this.category,
    this.categoryLabel,
    this.categoryTone,
    this.authorName,
    this.authorAvatarUrl,
    this.authorTitle,
    this.viewCount = 0,
    this.publishedAt,
    this.videoHlsUrl,
    this.videoPosterUrl,
    this.videoStatus,
    this.content = '',
    this.blocks = const [],
  });

  final String id;
  final String slug;
  final String title;
  final String? excerpt;
  final String? coverUrl;
  final String? category;
  final String? categoryLabel;
  final String? categoryTone;
  final String? authorName;
  final String? authorAvatarUrl;
  final String? authorTitle;
  final int viewCount;
  final String? publishedAt;
  final String? videoHlsUrl;
  final String? videoPosterUrl;
  final String? videoStatus;
  final String content;
  final List<ArticleBlock> blocks;

  bool get hasReadyVideo =>
      videoStatus == 'READY' && (videoHlsUrl?.isNotEmpty ?? false);

  factory ArticleDetail.fromJson(Map<String, dynamic> json) {
    final author = json['author'];
    final byline = json['bylineAuthor'];
    final blocks =
        (json['blocks'] as List?)
            ?.whereType<Map>()
            .map((b) => ArticleBlock.fromJson(Map<String, dynamic>.from(b)))
            .toList() ??
        const <ArticleBlock>[];
    return ArticleDetail(
      id: '${json['id']}',
      slug: '${json['slug'] ?? ''}',
      title: '${json['title'] ?? ''}',
      excerpt: json['excerpt'] as String?,
      coverUrl: json['coverUrl'] as String?,
      category: json['category'] as String?,
      categoryLabel: json['categoryLabel'] as String?,
      categoryTone: json['categoryTone'] as String?,
      authorName: author is Map ? author['name'] as String? : null,
      authorAvatarUrl: author is Map ? author['avatarUrl'] as String? : null,
      authorTitle: byline is Map ? byline['title'] as String? : null,
      viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      publishedAt: json['publishedAt'] as String?,
      videoHlsUrl: json['videoHlsUrl'] as String?,
      videoPosterUrl: json['videoPosterUrl'] as String?,
      videoStatus: json['videoStatus'] as String?,
      content: '${json['content'] ?? ''}',
      blocks: blocks,
    );
  }
}

class HomeFeed {
  const HomeFeed({
    this.featured = const [],
    this.topGrid = const [],
    this.stuNews = const [],
    this.stuData = const [],
    this.stuStories = const [],
    this.stuTalk = const [],
  });

  final List<ArticleCard> featured;
  final List<ArticleCard> topGrid;
  final List<ArticleCard> stuNews;
  final List<ArticleCard> stuData;
  final List<ArticleCard> stuStories;
  final List<ArticleCard> stuTalk;

  factory HomeFeed.fromJson(Map<String, dynamic> json) {
    List<ArticleCard> list(String key) =>
        (json[key] as List?)
            ?.whereType<Map>()
            .map((e) => ArticleCard.fromJson(Map<String, dynamic>.from(e)))
            .toList() ??
        const [];
    return HomeFeed(
      featured: list('featured'),
      topGrid: list('topGrid'),
      stuNews: list('stuNews'),
      stuData: list('stuData'),
      stuStories: list('stuStories'),
      stuTalk: list('stuTalk'),
    );
  }
}

class CategoryFeed {
  const CategoryFeed({
    required this.category,
    required this.label,
    required this.tone,
    required this.items,
    this.mostRead = const [],
    this.total = 0,
  });

  final String category;
  final String label;
  final String tone;
  final List<ArticleCard> items;
  final List<ArticleCard> mostRead;
  final int total;

  factory CategoryFeed.fromJson(Map<String, dynamic> json) {
    List<ArticleCard> list(String key) =>
        (json[key] as List?)
            ?.whereType<Map>()
            .map((e) => ArticleCard.fromJson(Map<String, dynamic>.from(e)))
            .toList() ??
        const [];
    return CategoryFeed(
      category: '${json['category'] ?? ''}',
      label: '${json['label'] ?? ''}',
      tone: '${json['tone'] ?? 'teal'}',
      items: list('items'),
      mostRead: list('mostRead'),
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

class Subscriber {
  const Subscriber({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.avatarUrl,
    this.emailVerified = false,
  });

  final String id;
  final String name;
  final String email;
  final String? phone;
  final String? avatarUrl;
  final bool emailVerified;

  factory Subscriber.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    return Subscriber(
      id: id == null ? '' : '$id',
      name: '${json['name'] ?? ''}',
      email: '${json['email'] ?? ''}',
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      emailVerified: json['emailVerified'] == true,
    );
  }
}

class AppSettings {
  const AppSettings({
    this.captcha = false,
    this.turnstileSiteKey = '',
    this.googleClientId = '',
    this.googleIosClientId = '',
  });

  final bool captcha;
  final String turnstileSiteKey;
  final String googleClientId;
  final String googleIosClientId;

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    return AppSettings(
      captcha: json['captcha'] == true,
      turnstileSiteKey: '${json['turnstileSiteKey'] ?? ''}',
      googleClientId: '${json['googleClientId'] ?? ''}',
      googleIosClientId: '${json['googleIosClientId'] ?? ''}',
    );
  }
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final Subscriber user;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    final userJson = json['user'] is Map
        ? Map<String, dynamic>.from(json['user'] as Map)
        : json;
    return AuthSession(
      accessToken: '${json['accessToken'] ?? ''}',
      refreshToken: '${json['refreshToken'] ?? ''}',
      user: Subscriber.fromJson(userJson),
    );
  }
}

class MagazineCard {
  const MagazineCard({
    required this.id,
    required this.title,
    this.issueNumber,
    this.coverUrl,
    this.dateLabel = '',
    this.priceCents,
    this.currency = 'USD',
    this.accessType,
    this.description,
    this.bgColor,
    this.accentColor,
  });

  final String id;
  final String title;
  final String? issueNumber;
  final String? coverUrl;
  final String dateLabel;
  final int? priceCents;
  final String currency;
  final String? accessType;
  final String? description;
  final String? bgColor;
  final String? accentColor;

  bool get isFree => accessType == 'FREE';

  factory MagazineCard.fromJson(Map<String, dynamic> json) {
    return MagazineCard(
      id: '${json['id']}',
      title: '${json['title'] ?? ''}',
      issueNumber: json['issueNumber'] as String?,
      coverUrl: json['coverUrl'] as String?,
      dateLabel: '${json['dateLabel'] ?? ''}',
      priceCents: (json['priceCents'] as num?)?.toInt(),
      currency: '${json['currency'] ?? 'USD'}',
      accessType: json['accessType'] as String?,
      description: json['description'] as String?,
      bgColor: json['theme'] is Map
          ? json['theme']['bgColor'] as String?
          : json['bgColor'] as String?,
      accentColor: json['theme'] is Map
          ? json['theme']['accentColor'] as String?
          : json['accentColor'] as String?,
    );
  }
}

class MagazinePage {
  const MagazinePage({
    required this.pageNumber,
    required this.url,
    this.thumbUrl,
  });

  final int pageNumber;
  final String url;
  final String? thumbUrl;

  factory MagazinePage.fromJson(Map<String, dynamic> json) {
    return MagazinePage(
      pageNumber: (json['pageNumber'] as num?)?.toInt() ?? 0,
      url: '${json['url'] ?? ''}',
      thumbUrl: json['thumbUrl'] as String?,
    );
  }
}

class MagazineSession {
  const MagazineSession({
    required this.id,
    required this.title,
    required this.canRead,
    this.preview = false,
    this.maxPages,
    this.accessVia,
    this.accessType,
    this.message,
    this.pages = const [],
  });

  final String id;
  final String title;
  final bool canRead;
  final bool preview;
  final int? maxPages;
  final String? accessVia;
  final String? accessType;
  final String? message;
  final List<MagazinePage> pages;

  factory MagazineSession.fromJson(Map<String, dynamic> json) {
    return MagazineSession(
      id: '${json['id']}',
      title: '${json['title'] ?? ''}',
      canRead: json['canRead'] == true,
      preview: json['preview'] == true,
      maxPages: (json['maxPages'] as num?)?.toInt(),
      accessVia: json['accessVia'] as String?,
      accessType: json['accessType'] as String?,
      message: json['message'] as String?,
      pages:
          (json['pages'] as List?)
              ?.whereType<Map>()
              .map((e) => MagazinePage.fromJson(Map<String, dynamic>.from(e)))
              .toList() ??
          const [],
    );
  }
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    this.body,
    this.kind = '',
    this.href,
    this.coverUrl,
    this.unread = false,
    this.createdAt,
  });

  final String id;
  final String title;
  final String? body;
  final String kind;
  final String? href;
  final String? coverUrl;
  final bool unread;
  final DateTime? createdAt;

  bool get read => !unread;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    final unread = json['unread'] == true
        ? true
        : json['unread'] == false
            ? false
            : json['read'] != true && json['isRead'] != true;
    return AppNotification(
      id: '${json['id'] ?? json['notificationId'] ?? ''}',
      title: '${json['title'] ?? json['subject'] ?? 'Notification'}',
      body: (json['body'] ?? json['message'] ?? json['text']) as String?,
      kind: '${json['kind'] ?? json['type'] ?? ''}',
      href: json['href'] as String? ?? json['url'] as String?,
      coverUrl: json['coverUrl'] as String?,
      unread: unread,
      createdAt: _parseDate(json['createdAt']),
    );
  }

  static DateTime? _parseDate(dynamic raw) {
    if (raw == null) return null;
    if (raw is DateTime) return raw;
    return DateTime.tryParse('$raw');
  }
}

class PurchaseItem {
  const PurchaseItem({
    required this.id,
    required this.title,
    this.coverUrl,
    this.magazineId,
  });

  final String id;
  final String title;
  final String? coverUrl;
  final String? magazineId;

  factory PurchaseItem.fromJson(Map<String, dynamic> json) {
    final mag = json['magazine'];
    return PurchaseItem(
      id: '${json['id']}',
      title: mag is Map
          ? '${mag['title'] ?? json['title'] ?? 'Magazine'}'
          : '${json['title'] ?? 'Achat'}',
      coverUrl: mag is Map
          ? mag['coverUrl'] as String?
          : json['coverUrl'] as String?,
      magazineId: mag is Map ? '${mag['id']}' : json['magazineId'] as String?,
    );
  }
}

/// Diapo d’un statut : image, vidéo, texte et/ou raccourci article.
class StatusSlide {
  const StatusSlide({
    required this.id,
    this.mediaType,
    this.mediaUrl,
    this.posterUrl,
    this.imageFit = 'COVER',
    this.caption,
    this.durationSec = 6,
    this.article,
  });

  final String id;

  /// 'IMAGE' | 'VIDEO' | null (raccourci article / texte)
  final String? mediaType;
  final String? mediaUrl;
  final String? posterUrl;

  /// 'COVER' (plein écran) | 'FIT' (image entière)
  final String imageFit;
  final String? caption;
  final int durationSec;
  final ArticleCard? article;

  bool get isVideo => mediaType == 'VIDEO' && (mediaUrl?.isNotEmpty ?? false);
  bool get isImage => mediaType == 'IMAGE' && (mediaUrl?.isNotEmpty ?? false);
  bool get fitsImage => isImage && imageFit == 'FIT';

  /// Image représentant la diapo (bulle, préchargement).
  String? get thumbUrl {
    if (isImage) return mediaUrl;
    if (isVideo) return posterUrl ?? article?.coverUrl;
    return article?.coverUrl;
  }

  factory StatusSlide.fromJson(Map<String, dynamic> json, {String? fallbackId}) {
    final rawArticle = json['article'];
    return StatusSlide(
      id: '${json['id'] ?? fallbackId}',
      mediaType: json['mediaType'] as String?,
      mediaUrl: json['mediaUrl'] as String?,
      posterUrl: json['posterUrl'] as String?,
      imageFit: json['imageFit'] == 'FIT' ? 'FIT' : 'COVER',
      caption: json['caption'] as String?,
      durationSec: (json['durationSec'] as num?)?.toInt() ?? 6,
      article: rawArticle is Map
          ? ArticleCard.fromJson(Map<String, dynamic>.from(rawArticle))
          : null,
    );
  }
}

/// Statut éphémère (stories) publié depuis le dashboard admin :
/// une bulle, une ou plusieurs diapos.
class StatusItem {
  const StatusItem({
    required this.id,
    required this.slides,
    required this.publishedAt,
    required this.expiresAt,
  });

  final String id;
  final List<StatusSlide> slides;
  final DateTime publishedAt;
  final DateTime expiresAt;

  StatusSlide get first => slides.first;

  /// Image affichée dans la bulle.
  String? get thumbUrl => first.thumbUrl;

  bool get isVideo => first.isVideo;

  /// Libellé court sous la bulle.
  String get label {
    for (final slide in slides) {
      final text = slide.caption?.trim();
      if (text != null && text.isNotEmpty) return text;
    }
    for (final slide in slides) {
      final a = slide.article;
      if (a != null && a.categoryLabel.isNotEmpty) return a.categoryLabel;
    }
    return 'STUDRC';
  }

  factory StatusItem.fromJson(Map<String, dynamic> json) {
    final id = '${json['id']}';
    final rawSlides = json['slides'];
    final slides = rawSlides is List
        ? rawSlides
              .whereType<Map>()
              .map((s) => StatusSlide.fromJson(Map<String, dynamic>.from(s)))
              .toList()
        // Ancien format (une seule diapo à plat)
        : [StatusSlide.fromJson(json, fallbackId: id)];
    return StatusItem(
      id: id,
      slides: slides.isEmpty
          ? [StatusSlide.fromJson(json, fallbackId: id)]
          : slides,
      publishedAt:
          DateTime.tryParse('${json['publishedAt']}')?.toLocal() ??
          DateTime.now(),
      expiresAt:
          DateTime.tryParse('${json['expiresAt']}')?.toLocal() ??
          DateTime.now().add(const Duration(hours: 24)),
    );
  }
}
