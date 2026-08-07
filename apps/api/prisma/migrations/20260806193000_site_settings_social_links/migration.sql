-- AlterTable: add flexible social links JSON
ALTER TABLE "site_settings" ADD COLUMN "socialLinks" JSONB NOT NULL DEFAULT '[]';

UPDATE "site_settings"
SET "socialLinks" = '[]'::jsonb
WHERE id = 'default';

UPDATE "site_settings"
SET "socialLinks" = "socialLinks" || jsonb_build_array(
  jsonb_build_object(
    'id', 'fb-legacy',
    'network', 'facebook',
    'label', 'Facebook',
    'url', "facebookUrl"
  )
)
WHERE id = 'default'
  AND "facebookUrl" IS NOT NULL
  AND btrim("facebookUrl") <> '';

UPDATE "site_settings"
SET "socialLinks" = "socialLinks" || jsonb_build_array(
  jsonb_build_object(
    'id', 'x-legacy',
    'network', 'twitter',
    'label', 'X / Twitter',
    'url', "twitterUrl"
  )
)
WHERE id = 'default'
  AND "twitterUrl" IS NOT NULL
  AND btrim("twitterUrl") <> '';

UPDATE "site_settings"
SET "socialLinks" = "socialLinks" || jsonb_build_array(
  jsonb_build_object(
    'id', 'ig-legacy',
    'network', 'instagram',
    'label', 'Instagram',
    'url', "instagramUrl"
  )
)
WHERE id = 'default'
  AND "instagramUrl" IS NOT NULL
  AND btrim("instagramUrl") <> '';

UPDATE "site_settings"
SET "socialLinks" = "socialLinks" || jsonb_build_array(
  jsonb_build_object(
    'id', 'li-legacy',
    'network', 'linkedin',
    'label', 'LinkedIn',
    'url', "linkedinUrl"
  )
)
WHERE id = 'default'
  AND "linkedinUrl" IS NOT NULL
  AND btrim("linkedinUrl") <> '';

ALTER TABLE "site_settings" DROP COLUMN "facebookUrl";
ALTER TABLE "site_settings" DROP COLUMN "twitterUrl";
ALTER TABLE "site_settings" DROP COLUMN "instagramUrl";
ALTER TABLE "site_settings" DROP COLUMN "linkedinUrl";
