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
  (slug: 'stu-news', label: 'STU NEWS', tone: 'red'),
  (slug: 'stu-data', label: 'STU DATA', tone: 'blue'),
  (slug: 'stu-stories', label: 'STU STORIES', tone: 'gold'),
  (slug: 'stu-talk', label: 'STU TALK', tone: 'teal'),
];

bool isVideoRubrique(String? category, [String? label]) {
  bool match(String? value) {
    if (value == null) return false;
    final key = value.trim().toLowerCase();
    return key == 'stu-stories' ||
        key == 'stu stories' ||
        key == 'stu-talk' ||
        key == 'stu talk' ||
        key == 'inspirationnel' ||
        key == 'game-changers' ||
        key == 'game-changer' ||
        key == 'grandes-entrevues' ||
        key == 'grande-entrevue' ||
        key == 'entrevue-croisee';
  }

  return match(category) || match(label);
}
