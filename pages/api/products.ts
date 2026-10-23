import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { withCors } from "@/lib/cors";
import { validateRouteSteps } from "@/lib/product-route";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};


interface ProductRecipeInput {
  id?: number;
  resourceType: "FABRIC" | "ACCESSORY";
  fabricId?: number | string | null;
  accessoryId?: number | string | null;
  quantityPerUnit: number | string;
  unit: string;
}

function isRecipeSchemaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('ProductRecipe') ||
    message.includes('product_recipes') ||
    message.includes('P2021') ||
    message.includes('P2022')
  );
}

function isWarehouseCompatibilityError(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    message.includes("unknown field `warehouse`") ||
    message.includes("unknown argument `warehouseid`") ||
    message.includes("cannot read properties of undefined") ||
    message.includes("does not exist")
  );
}

function isTransientDbError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  return code === 'P2037' || message.toLowerCase().includes('too many clients');
}

function isMissingColumnError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    code === 'P2022' ||
    message.includes('does not exist') ||
    message.includes('unknown field')
  );
}

const parseOptionalId = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

type WarehouseClientDelegate = {
  findUnique: (args: { where: { id: number }; select: { id: true } }) => Promise<{ id: number } | null>;
};

function getWarehouseDelegate(): WarehouseClientDelegate | null {
  const candidate = (prisma as unknown as { warehouse?: unknown }).warehouse;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  return candidate as WarehouseClientDelegate;
}

async function resolveWarehouseId(warehouseId: unknown): Promise<number | null> {
  const parsedWarehouseId = parseOptionalId(warehouseId);
  if (parsedWarehouseId === null) return null;

  const warehouseDelegate = getWarehouseDelegate();
  if (!warehouseDelegate) {
    return null;
  }

  const warehouse = await warehouseDelegate.findUnique({
    where: { id: parsedWarehouseId },
    select: { id: true },
  });

  if (!warehouse) {
    throw new Error("Secilen depo bulunamadi.");
  }

  return warehouse.id;
}

const productSelectWithoutWarehouseNoRecipes = {
  id: true,
  modelNo: true,
  name: true,
  materialTypeId: true,
  fabricId: true,
  groupId: true,
  taxRateId: true,
  description: true,
  image: true,
  backImage: true,
  frontImages: true,
  backImages: true,
  criticalNotes: true,
  routeSteps: true,
  averageGrammage: true,
  createdAt: true,
  materialType: {
    select: {
      id: true,
      name: true,
    },
  },
  fabric: {
    select: {
      id: true,
      code: true,
      name: true,
      property: true,
      width: true,
      length: true,
      depot: true,
      unit: true,
      stockQuantity: true,
      averageGrammage: true,
      createdAt: true,
    },
  },
  group: {
    select: {
      id: true,
      name: true,
    },
  },
  taxRate: {
    select: {
      id: true,
      name: true,
      rate: true,
    },
  },
} as const;

const productSelectCore = {
  id: true,
  modelNo: true,
  name: true,
} as const;

const productSelectWithoutWarehouseWithRecipes = {
  ...productSelectWithoutWarehouseNoRecipes,
  recipes: {
    select: {
      id: true,
      resourceType: true,
      fabricId: true,
      accessoryId: true,
      quantityPerUnit: true,
      unit: true,
      fabric: {
        select: {
          id: true,
          code: true,
          name: true,
          property: true,
          width: true,
          length: true,
          depot: true,
          unit: true,
          stockQuantity: true,
          createdAt: true,
        },
      },
      accessory: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          stockQuantity: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
} as const;

const productSelectWithWarehouseNoRecipes = {
  ...productSelectWithoutWarehouseNoRecipes,
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
    },
  },
} as const;

const productSelectWithWarehouseWithRecipes = {
  ...productSelectWithWarehouseNoRecipes,
  recipes: productSelectWithoutWarehouseWithRecipes.recipes,
} as const;

let hasProductWarehouseColumnCache: boolean | null = null;

async function hasProductWarehouseColumn(): Promise<boolean> {
  if (hasProductWarehouseColumnCache !== null) {
    return hasProductWarehouseColumnCache;
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'Product' AND column_name = 'warehouseId'"
    );
    hasProductWarehouseColumnCache = rows.length > 0;
  } catch {
    hasProductWarehouseColumnCache = false;
  }

  return hasProductWarehouseColumnCache;
}

async function listProductsSafe() {
  const canUseWarehouse = await hasProductWarehouseColumn();

  try {
    return await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      select: canUseWarehouse
        ? productSelectWithWarehouseWithRecipes
        : productSelectWithoutWarehouseWithRecipes,
    });
  } catch (error) {
    if (!canUseWarehouse && isRecipeSchemaError(error)) {
      return prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        select: productSelectWithoutWarehouseNoRecipes,
      });
    }

    if (isWarehouseCompatibilityError(error)) {
      try {
        return await prisma.product.findMany({
          orderBy: { createdAt: 'desc' },
          select: productSelectWithoutWarehouseWithRecipes,
        });
      } catch (innerError) {
        if (!isRecipeSchemaError(innerError)) throw innerError;
        return prisma.product.findMany({
          orderBy: { createdAt: 'desc' },
          select: productSelectWithoutWarehouseNoRecipes,
        });
      }
    }

    if (isRecipeSchemaError(error)) {
      try {
        return await prisma.product.findMany({
          orderBy: { createdAt: 'desc' },
          select: productSelectWithWarehouseNoRecipes,
        });
      } catch (innerError) {
        if (!isWarehouseCompatibilityError(innerError)) throw innerError;
        return prisma.product.findMany({
          orderBy: { createdAt: 'desc' },
          select: productSelectWithoutWarehouseNoRecipes,
        });
      }
    }

    if (isMissingColumnError(error)) {
      return prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        select: productSelectCore,
      });
    }

    throw error;
  }
}

async function getProductByIdSafe(productId: number) {
  const canUseWarehouse = await hasProductWarehouseColumn();

  try {
    return await prisma.product.findUnique({
      where: { id: productId },
      select: canUseWarehouse
        ? productSelectWithWarehouseWithRecipes
        : productSelectWithoutWarehouseWithRecipes,
    });
  } catch (error) {
    if (!canUseWarehouse && isRecipeSchemaError(error)) {
      return prisma.product.findUnique({
        where: { id: productId },
        select: productSelectWithoutWarehouseNoRecipes,
      });
    }

    if (isWarehouseCompatibilityError(error)) {
      try {
        return await prisma.product.findUnique({
          where: { id: productId },
          select: productSelectWithoutWarehouseWithRecipes,
        });
      } catch (innerError) {
        if (!isRecipeSchemaError(innerError)) throw innerError;
        return prisma.product.findUnique({
          where: { id: productId },
          select: productSelectWithoutWarehouseNoRecipes,
        });
      }
    }

    if (isRecipeSchemaError(error)) {
      try {
        return await prisma.product.findUnique({
          where: { id: productId },
          select: productSelectWithWarehouseNoRecipes,
        });
      } catch (innerError) {
        if (!isWarehouseCompatibilityError(innerError)) throw innerError;
        return prisma.product.findUnique({
          where: { id: productId },
          select: productSelectWithoutWarehouseNoRecipes,
        });
      }
    }

    if (isMissingColumnError(error)) {
      return prisma.product.findUnique({
        where: { id: productId },
        select: productSelectCore,
      });
    }

    throw error;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  const auth = await requireApiAuth(req, res, {
    requireLicense: true,
    feature: "stock",
  });
  if (!auth) return;

  try {
    if (req.method === 'POST') {
      const {
        modelNo,
        name,
        materialTypeId,
        fabricId,
        groupId,
        taxRateId,
        warehouseId,
        description,
        image,
        frontImage,
        backImage,
        frontImages,
        backImages,
        criticalNotes,
        routeSteps,
        averageGrammage,
        recipes = [],
      } = req.body;

      // Validasyon
      if (!modelNo || !name) {
        return res.status(400).json({ message: 'Model No ve Ürün Adı zorunludur.' });
      }
      const routeValidation = routeSteps === undefined || routeSteps === null ? null : validateRouteSteps(routeSteps);
      if (routeValidation && routeValidation.valid === false) {
        return res.status(400).json({ message: routeValidation.message });
      }
      if (!isValidCriticalNotes(criticalNotes)) {
        return res.status(400).json({ message: 'Kritik notlar geçerli bir liste olmalıdır.' });
      }
      if (!isValidProductImages(frontImages) || !isValidProductImages(backImages)) {
        return res.status(400).json({ message: 'Ön ve arka fotoğraflar en fazla 5 görselden oluşan geçerli listeler olmalıdır.' });
      }

      // Benzersizlik kontrolü
      const existingProduct = await prisma.product.findUnique({
        where: { modelNo },
        select: { id: true },
      });
      if (existingProduct) {
        return res.status(400).json({ message: 'Bu Model No zaten mevcut.' });
      }

      const canUseWarehouse = await hasProductWarehouseColumn();
      const resolvedWarehouseId = canUseWarehouse ? await resolveWarehouseId(warehouseId) : null;

      const baseData = {
        modelNo,
        name,
        materialTypeId: materialTypeId ? parseInt(materialTypeId) : null,
        fabricId: fabricId ? parseInt(fabricId) : null,
        groupId: groupId ? parseInt(groupId) : null,
        taxRateId: taxRateId ? parseInt(taxRateId) : null,
        description,
        image: image ?? frontImage ?? (Array.isArray(frontImages) ? frontImages[0] : null) ?? null,
        backImage: backImage ?? (Array.isArray(backImages) ? backImages[0] : null) ?? null,
        frontImages: frontImages ?? (image || frontImage ? [image ?? frontImage] : null),
        backImages: backImages ?? (backImage ? [backImage] : null),
        criticalNotes: criticalNotes ?? null,
        ...(routeValidation && routeValidation.valid ? { routeSteps: routeValidation.steps } : {}),
        averageGrammage: averageGrammage === '' || averageGrammage == null ? null : parseFloat(averageGrammage),
        recipes: {
          create: normalizeRecipes(recipes),
        },
      };

      let createdProductId: number;
      try {
        const created = await prisma.product.create({
          data:
            resolvedWarehouseId === null
              ? baseData
              : {
                  ...baseData,
                  warehouseId: resolvedWarehouseId,
                },
          select: { id: true },
        });
        createdProductId = created.id;
      } catch (createError) {
        if (!isWarehouseCompatibilityError(createError)) {
          throw createError;
        }
        const created = await prisma.product.create({
          data: baseData,
          select: { id: true },
        });
        createdProductId = created.id;
      }

      const newProduct = await getProductByIdSafe(createdProductId);
      if (!newProduct) {
        return res.status(500).json({ message: 'Urun olusturuldu ancak okunamadi.' });
      }

      console.log('New product added:', { id: newProduct.id, modelNo: newProduct.modelNo });
      return res.status(201).json({ message: 'Ürün başarıyla eklendi', product: newProduct });
    }

    if (req.method === 'GET') {
      if (req.query.checkCode) {
        const code = req.query.checkCode as string;
        const existingProduct = await prisma.product.findUnique({
          where: { modelNo: code },
          select: { id: true },
        });
        return res.status(200).json({ isAvailable: !existingProduct });
      }

      const products = await listProductsSafe();
      return res.status(200).json(products);
    }

    if (req.method === 'PUT') {
const {
  id,
  modelNo,
  name,
  materialTypeId,
  fabricId,
  groupId,
  taxRateId,
  warehouseId,
  description,
  image,
  frontImage,
  backImage,
  frontImages,
  backImages,
  criticalNotes,
  routeSteps,
  averageGrammage,
  recipes = [],
} = req.body;
       const productId = parseInt(id);

      if (!productId || !modelNo || !name) {
        return res.status(400).json({ message: 'ID, Model No ve Ürün Adı zorunludur.' });
      }
      const routeValidation = routeSteps === undefined ? null : validateRouteSteps(routeSteps);
      if (routeValidation && routeValidation.valid === false) {
        return res.status(400).json({ message: routeValidation.message });
      }
      if (criticalNotes !== undefined && !isValidCriticalNotes(criticalNotes)) {
        return res.status(400).json({ message: 'Kritik notlar geçerli bir liste olmalıdır.' });
      }
      if (
        (frontImages !== undefined && !isValidProductImages(frontImages)) ||
        (backImages !== undefined && !isValidProductImages(backImages))
      ) {
        return res.status(400).json({ message: 'Ön ve arka fotoğraflar en fazla 5 görselden oluşan geçerli listeler olmalıdır.' });
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!existingProduct) {
        return res.status(404).json({ message: 'Ürün bulunamadı.' });
      }

      // Model No benzersizlik kontrolü
      const modelNoConflict = await prisma.product.findFirst({
        where: { modelNo, id: { not: productId } },
        select: { id: true },
      });
      if (modelNoConflict) {
        return res.status(400).json({ message: 'Bu Model No başka bir ürün tarafından kullanılıyor.' });
      }

      const canUseWarehouse = await hasProductWarehouseColumn();
      const resolvedWarehouseId = canUseWarehouse ? await resolveWarehouseId(warehouseId) : null;

      const baseData = {
        modelNo,
        name,
        materialTypeId: materialTypeId ? parseInt(materialTypeId) : null,
        fabricId: fabricId ? parseInt(fabricId) : null,
        groupId: groupId ? parseInt(groupId) : null,
        taxRateId: taxRateId ? parseInt(taxRateId) : null,
        description,
        ...(frontImages !== undefined
          ? { frontImages, image: Array.isArray(frontImages) ? frontImages[0] ?? null : null }
          : frontImage !== undefined || image !== undefined
            ? { image: frontImage !== undefined ? frontImage : image }
            : {}),
        ...(backImages !== undefined
          ? { backImages, backImage: Array.isArray(backImages) ? backImages[0] ?? null : null }
          : backImage !== undefined
            ? { backImage }
            : {}),
        ...(criticalNotes !== undefined ? { criticalNotes } : {}),
        ...(routeValidation && routeValidation.valid ? { routeSteps: routeValidation.steps } : {}),
        averageGrammage: averageGrammage === '' || averageGrammage == null ? null : parseFloat(averageGrammage),
        recipes: {
          deleteMany: {},
          create: normalizeRecipes(recipes),
        },
      };

      let updatedProductId: number;
      try {
        const updated = await prisma.product.update({
          where: { id: productId },
          data:
            resolvedWarehouseId === null
              ? baseData
              : {
                  ...baseData,
                  warehouseId: resolvedWarehouseId,
                },
          select: { id: true },
        });
        updatedProductId = updated.id;
      } catch (updateError) {
        if (!isWarehouseCompatibilityError(updateError)) {
          throw updateError;
        }
        const updated = await prisma.product.update({
          where: { id: productId },
          data: baseData,
          select: { id: true },
        });
        updatedProductId = updated.id;
      }

      const updatedProduct = await getProductByIdSafe(updatedProductId);
      if (!updatedProduct) {
        return res.status(500).json({ message: 'Urun guncellendi ancak okunamadi.' });
      }

      console.log('Product updated:', { id: updatedProduct.id, modelNo: updatedProduct.modelNo });
      return res.status(200).json({ message: 'Ürün başarıyla güncellendi', product: updatedProduct });
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id as string);

      if (!id) {
        return res.status(400).json({ message: 'Ürün ID zorunludur.' });
      }

      const existingProduct = await prisma.product.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existingProduct) {
        return res.status(404).json({ message: 'Ürün bulunamadı.' });
      }

      await prisma.product.delete({ where: { id }, select: { id: true } });
      console.log('Product deleted:', id);
      return res.status(200).json({ message: 'Ürün başarıyla silindi' });
    }

    return res.status(405).json({ message: 'Yalnızca GET, POST, PUT ve DELETE metodları destekleniyor.' });
  } catch (err: unknown) {
    console.error('API Error:', err);
    if (req.method === 'GET' && (isTransientDbError(err) || isMissingColumnError(err) || isWarehouseCompatibilityError(err) || isRecipeSchemaError(err))) {
      return res.status(200).json([]);
    }
    return res.status(500).json({
      message: 'Sunucu hatasi',
      error: err instanceof Error ? err.message : 'Bilinmeyen hata',
    });
  }
}

export default withCors(handler);

function isValidCriticalNotes(value: unknown): boolean {
  if (value == null) return true;
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every((note) => {
      if (!note || typeof note !== 'object') return false;
      const item = note as Record<string, unknown>;
      return (
        (item.side === 'front' || item.side === 'back') &&
        typeof item.text === 'string' &&
        item.text.trim().length > 0 &&
        item.text.length <= 500 &&
        typeof item.x === 'number' &&
        Number.isFinite(item.x) &&
        item.x >= 0 &&
        item.x <= 100 &&
        typeof item.y === 'number' &&
        Number.isFinite(item.y) &&
        item.y >= 0 &&
        item.y <= 100 &&
        (item.imageIndex === undefined ||
          (Number.isInteger(item.imageIndex) && Number(item.imageIndex) >= 0 && Number(item.imageIndex) < 5))
      );
    })
  );
}

function isValidProductImages(value: unknown): boolean {
  if (value == null) return true;
  return (
    Array.isArray(value) &&
    value.length <= 5 &&
    value.every((image) => typeof image === 'string' && image.length > 0 && image.length <= 12_000_000)
  );
}

function normalizeRecipes(recipes: ProductRecipeInput[]) {
  if (!Array.isArray(recipes)) {
    return [];
  }

  return recipes
    .map((recipe) => ({
      resourceType: recipe.resourceType,
      fabricId:
        recipe.resourceType === 'FABRIC' && recipe.fabricId
          ? parseInt(String(recipe.fabricId))
          : null,
      accessoryId:
        recipe.resourceType === 'ACCESSORY' && recipe.accessoryId
          ? parseInt(String(recipe.accessoryId))
          : null,
      quantityPerUnit: parseFloat(String(recipe.quantityPerUnit || 0)),
      unit: String(recipe.unit || '').trim().toLowerCase(),
    }))
    .filter((recipe) =>
      ['FABRIC', 'ACCESSORY'].includes(recipe.resourceType) &&
      ((recipe.resourceType === 'FABRIC' && !!recipe.fabricId) ||
        (recipe.resourceType === 'ACCESSORY' && !!recipe.accessoryId)) &&
      !Number.isNaN(recipe.quantityPerUnit) &&
      recipe.quantityPerUnit > 0 &&
      ['m', 'kg'].includes(recipe.unit)
    );
}
