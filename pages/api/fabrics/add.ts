import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const {
      code,
      name,
      type,
      group,
      property,
      unit,
      stockQuantity,
      width,
      length,
      depot,
    } = req.body;

    const fabric = await prisma.fabric.create({
      data: {
        code,
        name,
        type,
        group,
        property,
        unit,
        stockQuantity: parseFloat(stockQuantity || 0),
        width: width ? parseFloat(width) : null,
        length: length ? parseFloat(length) : null,
        depot,
      },
    });

    return res.status(200).json(fabric);
  } catch (error: any) {
    console.error("Fabric create error:", error);
    return res.status(500).json({ message: "Error creating fabric", error });
  }
}
