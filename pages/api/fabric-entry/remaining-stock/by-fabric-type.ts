import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json([
    { id: 1, fabricType: "Pamuk", color: "Beyaz", weightKg: 100, lengthMeter: 200 },
    { id: 2, fabricType: "Polyester", color: "Mavi", weightKg: 50, lengthMeter: 120 }
  ]);
}
