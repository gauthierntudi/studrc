-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "facebookUrl" TEXT,
    "twitterUrl" TEXT,
    "instagramUrl" TEXT,
    "linkedinUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- Seed defaults (liens historiques Opt1mum)
INSERT INTO "site_settings" ("id", "facebookUrl", "twitterUrl", "instagramUrl", "linkedinUrl", "updatedAt")
VALUES (
  'default',
  'https://web.facebook.com/Opt1mumMag',
  'https://twitter.com/OptimumCorp',
  'https://www.instagram.com/',
  'https://www.linkedin.com/',
  CURRENT_TIMESTAMP
);
