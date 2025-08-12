import { NextApiRequest, NextApiResponse } from "next";
import prisma from "../../../lib/prisma";
import axios from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await axios.get("https://external-api.com/products");
    const products = response.data;

    for (const p of products) {
      await prisma.product.upsert({
        where: { modelNo: p.modelNo },
        update: {},
        create: { modelNo: p.modelNo, name: p.name }
      });
    }

    res.status(200).json({ message: "Products synced" });
  } catch (error) {
    res.status(500).json({ error: "API connection failed" });
  }
}
