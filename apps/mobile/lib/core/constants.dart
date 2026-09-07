/// API de production par défaut (le site est déjà en ligne).
const kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://api.studrc.com/api',
);

const kCdnBaseUrl = 'https://cdn.studrc.com';
const kSiteUrl = 'https://studrc.com';

const kTurnstileSiteKey = String.fromEnvironment('TURNSTILE_SITE_KEY');

const kBrandNavy = 0xFF00132B;
const kBrandGold = 0xFFFDBD01;
const kBrandRed = 0xFFD63026;
const kBrandBlue = 0xFF0565AB;

const kRubriques = <({String slug, String label, String tone})>[
  (slug: 'stu-news', label: 'Stu News', tone: 'red'),
  (slug: 'stu-data', label: 'Stu Data', tone: 'blue'),
  (slug: 'stu-stories', label: 'Stu Stories', tone: 'gold'),
  (slug: 'stu-talk', label: 'Stu Talk', tone: 'teal'),
];

const kNewsRubriques = <({String slug, String label, String tone})>[
  ...kRubriques,
  (slug: 'stu-short', label: 'Short', tone: 'gold'),
];

/// Title case for rubrique names (`STU NEWS` → `Stu News`).
String capitalizeLabel(String value) {
  final parts = value.trim().split(RegExp(r'[\s_-]+'));
  return [
    for (final part in parts)
      if (part.isNotEmpty)
        '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
  ].join(' ');
}

String toneFromCategory(String? category, [String? label]) {
  final candidates = [category, label].whereType<String>().map(
    (v) => v.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-'),
  );

  const aliases = <String, String>{
    'stu-news': 'red',
    'stu-data': 'blue',
    'stu-stories': 'gold',
    'stu-talk': 'teal',
    'stu-short': 'gold',
    'stu-mag': 'dark',
    'edito': 'red',
    'start-up': 'red',
    'vus-sur-le-net': 'red',
    'zoom': 'red',
    'decryptages': 'blue',
    'decryptage': 'blue',
    'inspirationnel': 'gold',
    'game-changers': 'gold',
    'game-changer': 'gold',
    'grandes-entrevues': 'teal',
    'grande-entrevue': 'teal',
    'entrevue-croisee': 'teal',
  };

  for (final key in candidates) {
    if (key.isEmpty) continue;
    final mapped = aliases[key];
    if (mapped != null) return mapped;
    for (final r in kRubriques) {
      if (key == r.slug) return r.tone;
    }
  }
  return 'red';
}

bool isPortraitRubrique(String? slug) {
  final key = slug?.trim().toLowerCase() ?? '';
  return key == 'stu-stories' || key == 'stu-talk';
}

bool isShortRubrique(String? category, [String? label]) {
  bool match(String? value) {
    if (value == null) return false;
    final key = value.trim().toLowerCase();
    return key == 'stu-short' || key == 'short';
  }

  return match(category) || match(label);
}

bool isVideoRubrique(String? category, [String? label]) {
  bool match(String? value) {
    if (value == null) return false;
    final key = value.trim().toLowerCase();
    return key == 'stu-stories' ||
        key == 'stu stories' ||
        key == 'stu-talk' ||
        key == 'stu talk' ||
        key == 'stu-short' ||
        key == 'short' ||
        key == 'inspirationnel' ||
        key == 'game-changers' ||
        key == 'game-changer' ||
        key == 'grandes-entrevues' ||
        key == 'grande-entrevue' ||
        key == 'entrevue-croisee';
  }

  return match(category) || match(label);
}
