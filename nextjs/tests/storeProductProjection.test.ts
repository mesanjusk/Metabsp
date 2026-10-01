import { describe, expect, it } from 'vitest';
import { buildStoreProductProjection, isStoreProjection } from '@/lib/store/syncProductToSmb';

describe('store product SMB projection', () => {
  it('uses StoreProduct as the source of truth for catalogue and stock projections', () => {
    const projection = buildStoreProductProjection({
      _id: 'product-1',
      ownerUserId: 'user-1',
      name: 'Premium Card',
      sku: 'CARD-01',
      slug: 'premium-card',
      priceInPaise: 10000,
      salePriceInPaise: 8500,
      stock: 12,
      trackInventory: true,
      isActive: true,
      images: ['https://example.com/a.jpg'],
    });

    expect(projection.product.reference).toBe('store-product:product-1');
    expect(projection.product.amountInPaise).toBe(8500);
    expect(projection.product.quantity).toBe(12);
    expect(projection.inventory.reference).toBe('store-stock:product-1');
    expect(projection.inventory.quantity).toBe(12);
    expect(isStoreProjection(projection.product)).toBe(true);
  });
});
