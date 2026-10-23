const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true }
  });
  console.log("Total users:", users.length);
  users.forEach(u => console.log(`- ${u.id}: ${u.name} (${u.email})`));
  
  const messages = await prisma.message.findMany({
    select: { id: true, senderId: true, recipientId: true, content: true }
  });
  console.log("\nTotal messages:", messages.length);
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
