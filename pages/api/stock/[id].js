import { prisma } from '../../../lib/prisma';
import { authenticateToken } from '../../../lib/auth';
import { z } from 'zod';

// Define validation schemas
const stockSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.number().min(0, 'Quantity must be positive'),
  price: z.number().min(0, 'Price must be positive'),
  category: z.string().optional(),
  description: z.string().optional()
});

// Validation middleware
const validateRequest = (schema) => async (data) => {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    throw new Error(error.errors.map(e => e.message).join(', '));
  }
};

export default async function handler(req, res) {
  try {
    // Verify authentication token
    const user = await authenticateToken(req, res);
    if (!user) return;

    const { id } = req.query;

    switch (req.method) {
      case 'GET':
        const stock = await prisma.stock.findUnique({
          where: { id: parseInt(id) }
        });
        if (!stock) {
          return res.status(404).json({ error: 'Stock not found' });
        }
        return res.status(200).json(stock);

      case 'PUT':
        // Validate request body
        const validatedData = await validateRequest(stockSchema)(req.body);
        const updatedStock = await prisma.stock.update({
          where: { id: parseInt(id) },
          data: validatedData
        });
        return res.status(200).json(updatedStock);

      case 'DELETE':
        try {
          await prisma.stock.delete({
            where: { id: parseInt(id) }
          });
          return res.status(204).end();
        } catch (error) {
          if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Stock not found' });
          }
          throw error;
        }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    if (error.message.includes('validation')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to process request' });
  }
}