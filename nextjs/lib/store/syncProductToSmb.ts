import SmbRecord from '../models/SmbRecord';
import StoreProduct from '../models/StoreProduct';

const productReference = (id: unknown) => 'store-product:' + String(id);
const inventoryReference = (id: unknown) => 'store-stock:' + String(id);

export function buildStoreProductProjection(product: any) {
  const id = String(product?._id || '');
  const ownerUserId = product?.ownerUserId;
  const effectivePrice =
    product?.salePriceInPaise !== null && product?.salePriceInPaise !== undefined
      ? Number(product.salePriceInPaise || 0)
      : Number(product?.priceInPaise || 0);

  const sharedData = {
    sourceOfTruth: 'store_product',
    readOnlyProjection: true,
    storeProductId: id,
    sku: String(product?.sku || ''),
    slug: String(product?.slug || ''),
    categoryId: product?.categoryId ? String(product.categoryId) : '',
    images: Array.isArray(product?.images) ? product.images : [],
    trackInventory: product?.trackInventory !== false,
    minOrderQuantity: Number(product?.minOrderQuantity || 1),
    regularPriceInPaise: Number(product?.priceInPaise || 0),
    salePriceInPaise:
      product?.salePriceInPaise === null || product?.salePriceInPaise === undefined
        ? null
        : Number(product.salePriceInPaise || 0),
  };

  return {
    product: {
      userId: ownerUserId,
      kind: 'product',
      title: String(product?.name || 'Store product'),
      status: product?.isActive === false ? 'inactive' : 'active',
      source: 'store',
      reference: productReference(id),
      amountInPaise: Math.max(0, effectivePrice),
      quantity: Math.max(0, Number(product?.stock || 0)),
      data: sharedData,
    },
    inventory: {
      userId: ownerUserId,
      kind: 'inventory',
      title: String(product?.name || 'Store product') + ' stock',
      status: product?.trackInventory === false ? 'disabled' : 'active',
      source: 'store',
      reference: inventoryReference(id),
      amountInPaise: 0,
      quantity: Math.max(0, Number(product?.stock || 0)),
      data: sharedData,
    },
  };
}

export async function syncStoreProductProjection(product: any) {
  if (!product?._id || !product?.ownerUserId) return null;

  const projection = buildStoreProductProjection(product);

  const [productRecord, inventoryRecord] = await Promise.all([
    SmbRecord.findOneAndUpdate(
      {
        userId: product.ownerUserId,
        kind: 'product',
        reference: projection.product.reference,
      },
      { $set: projection.product },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    SmbRecord.findOneAndUpdate(
      {
        userId: product.ownerUserId,
        kind: 'inventory',
        reference: projection.inventory.reference,
      },
      { $set: projection.inventory },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
  ]);

  return { productRecord, inventoryRecord };
}

export async function removeStoreProductProjection(ownerUserId: any, storeProductId: any) {
  return SmbRecord.deleteMany({
    userId: ownerUserId,
    reference: { $in: [productReference(storeProductId), inventoryReference(storeProductId)] },
    kind: { $in: ['product', 'inventory'] },
    'data.sourceOfTruth': 'store_product',
  });
}

export async function syncAllStoreProductsForOwner(ownerUserId: any) {
  const products = await StoreProduct.find({ ownerUserId });
  let synced = 0;
  const failures: Array<{ id: string; message: string }> = [];

  for (const product of products) {
    try {
      await syncStoreProductProjection(product);
      synced += 1;
    } catch (error: any) {
      failures.push({ id: String(product._id), message: error?.message || String(error) });
    }
  }

  return { total: products.length, synced, failures };
}

export function isStoreProjection(record: any) {
  return Boolean(record?.data?.readOnlyProjection && record?.data?.sourceOfTruth === 'store_product');
}
