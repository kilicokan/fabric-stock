import type { NextApiRequest, NextApiResponse } from 'next';

type ConsumptionTable = {
  cuttingTable: string;
  totalUsed: number;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { startDate, endDate } = req.query;

    // Simulate database query
    const mockData: ConsumptionTable[] = [
      { cuttingTable: 'Masa 1', totalUsed: 20 },
      { cuttingTable: 'Masa 2', totalUsed: 30 },
    ];

    // Filter by date if provided
    const filteredData = mockData.filter(item => {
      if (!startDate || !endDate) return true;
      // Add date filtering logic here if needed
      return true;
    });

    res.status(200).json(filteredData);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}