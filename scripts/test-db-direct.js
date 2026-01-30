const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient({
  log: ['error', 'warn', 'info'],
});

async function test() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL (first 60 chars):', process.env.DATABASE_URL?.substring(0, 60) + '...');
    
    await prisma.$connect();
    console.log('✓ Connected successfully!');
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✓ Query successful:', result);
    
    const suppliers = await prisma.supplier.findMany({ take: 1 });
    console.log('✓ Suppliers query successful. Count:', suppliers.length);
    
    await prisma.$disconnect();
    console.log('✓ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Code:', error.code);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
}

test();

