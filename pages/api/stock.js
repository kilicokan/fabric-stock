import { prisma } from '../../lib/prisma'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const stocks = await prisma.stock.findMany()
      res.status(200).json(stocks)
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stocks' })
    }
  }
}