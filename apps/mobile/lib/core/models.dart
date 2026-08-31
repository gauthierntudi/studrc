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

  bool get hasReadyVideo =>
      videoStatus == 'READY' && (videoHlsUrl?.isNotEmpty ?? false);

  String get durationLabel {
    final sec = videoDurationSec;
    if (sec == null || sec <= 0) return '';
    final minutes = (sec / 60).ceil().clamp(1, 9999);
    return '$minutes min';
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
      authorName: '${json['authorName'] ?? json['author']?['name'] ?? 'STUDRC'}',
      dateLabel: '${json['dateLabel'] ?? ''}',
      videoHlsUrl: json['videoHlsUrl'] as String?,
      videoPosterUrl: json['videoPosterUrl'] as String?,
      videoStatus: json['videoStatus'] as String?,
      videoDurationSec: (json['videoDurationSec'] as num?)?.toInt(),
    );
  }
}

class ArticleBlock {
  const ArticleBlock({
    this.title,
    this.coverUrl,
    required this.content,
  });

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
    this.authorName,
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
  final String? authorName;
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
    final blocks = (json['blocks'] as List?)
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
      authorName: author is Map ? author['name'] as String? : null,
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
    return Subscriber(
      id: '${json['id']}',
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
  });

  final bool captcha;
  final String turnstileSiteKey;

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    return AppSettings(
      captcha: json['captcha'] == true,
      turnstileSiteKey: '${json['turnstileSiteKey'] ?? ''}',
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
      pages: (json['pages'] as List?)
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
    this.read = false,
    this.createdAt,
  });

  final String id;
  final String title;
  final String? body;
  final bool read;
  final String? createdAt;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: '${json['id'] ?? json['notificationId'] ?? ''}',
      title: '${json['title'] ?? json['subject'] ?? 'Notification'}',
      body: (json['body'] ?? json['message'] ?? json['text']) as String?,
      read: json['read'] == true || json['isRead'] == true,
      createdAt: json['createdAt'] as String?,
    );
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
      coverUrl: mag is Map ? mag['coverUrl'] as String? : json['coverUrl'] as String?,
      magazineId: mag is Map ? '${mag['id']}' : json['magazineId'] as String?,
    );
  }
}
