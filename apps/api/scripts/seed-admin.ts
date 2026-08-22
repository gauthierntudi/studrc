import { resolve } from 'path';
import { config } from 'dotenv';
import { PrismaClient, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

config({ path: resolve(process.cwd(), '../../.env') });
config({ path: resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@studrc.com')
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMeAdmin123!';
  const name = process.env.ADMIN_NAME ?? 'Administrateur';

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin déjà présent: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({
    data: {
      email,
      name,
      passwordHash,
      role: AdminRole.SUPERADMIN,
    },
  });

  console.log(`Admin créé: ${email}`);
  console.log('Change le mot de passe après la première connexion.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
