-- Connexion « Se connecter avec Apple » : identifiant Apple stable
ALTER TABLE "subscribers" ADD COLUMN "appleSub" TEXT;
CREATE UNIQUE INDEX "subscribers_appleSub_key" ON "subscribers"("appleSub");
