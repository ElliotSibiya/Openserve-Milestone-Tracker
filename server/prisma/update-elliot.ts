import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update Elliot to superadmin
  await prisma.user.update({
    where: { email: 'elliot@openserve.co.za' },
    data: { role: 'superadmin' }
  });
  console.log('Elliot Sibiya is now Super Admin');

  // List all users
  const users = await prisma.user.findMany({
    select: { name: true, email: true, role: true }
  });
  console.log('\nAll users:');
  users.forEach(u => console.log(`  ${u.name} (${u.email}) - ${u.role}`));
}

main().finally(() => prisma.$disconnect());
