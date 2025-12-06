import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const staffMembers = [
  { name: 'Elliot Sibiya', email: 'elliot@openserve.co.za', password: 'Elliot@123' },
  { name: 'Zanele Mtshali', email: 'zanele@openserve.co.za', password: 'Zanele@123' },
  { name: 'Mpho Maduse', email: 'mpho@openserve.co.za', password: 'Mpho@123' },
  { name: 'Alistair Appel', email: 'alistair@openserve.co.za', password: 'Alistair@123' },
  { name: 'Sbongi Zakwe', email: 'sbongi@openserve.co.za', password: 'Sbongi@123' },
];

async function main() {
  console.log('Adding staff members...\n');

  for (const staff of staffMembers) {
    const existing = await prisma.user.findUnique({
      where: { email: staff.email },
    });

    if (existing) {
      console.log(`User ${staff.email} already exists, skipping...`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(staff.password, 12);

    await prisma.user.create({
      data: {
        name: staff.name,
        email: staff.email,
        password: hashedPassword,
        role: 'staff',
      },
    });

    console.log(`Created: ${staff.name} (${staff.email})`);
  }

  console.log('\nDone! Staff accounts created.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
