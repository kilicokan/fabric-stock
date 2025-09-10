import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash("1234", 10);

  await prisma.adminuser.create({
    data: {
      username: "mira_admin",
      password: hashed,
    },
  });
}

main()
  .then(() => {
    console.log("Admin user created");
    prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
