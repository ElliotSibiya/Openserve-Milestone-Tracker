import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create super admin account
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@openserve.co.za';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';

  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    const hashedPassword = await bcrypt.hash(superAdminPassword, 12);

    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: superAdminEmail,
        password: hashedPassword,
        role: 'superadmin',
      },
    });

    console.log(`Created super admin account: ${superAdminEmail}`);
  } else {
    console.log('Super admin account already exists');
  }

  // Create default global settings if they don't exist
  const existingSettings = await prisma.globalSettings.findFirst();

  if (!existingSettings) {
    await prisma.globalSettings.create({
      data: {
        defaultPlanningDays: 10,
        defaultFundingDays: 2,
        defaultWayleaveDays: 0, // Disabled by default - can be enabled per project
        defaultMaterialsDays: 15,
        defaultAnnouncementDays: 1,
        defaultKickOffDays: 2,
        defaultBuildDays: 20,
        defaultEccDays: 1,
        defaultIntegrationDays: 2,
        defaultRfaDays: 1,
      },
    });

    console.log('Created default global settings');
  } else {
    console.log('Global settings already exist');
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
