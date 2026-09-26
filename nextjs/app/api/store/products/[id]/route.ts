import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import StoreProduct from '@/lib/models/StoreProduct';
import StoreCategory from '@/lib/models/StoreCategory';
import { cleanImages, rupeesToPaise, storeSlug } from '@/lib/store/helpers';
import { removeStoreProductProjection, syncStoreProductProjection } from '@/lib/store/syncProductToSmb';
import logger from '@/lib/utils/logger';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    }

    const product: any = await StoreProduct.findOne({ _id: id, ownerUserId: authed.doc._id });
    if (!product) {
      return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    }

    if (body.categoryId) {
      const category = await StoreCategory.findOne({
        _id: body.categoryId,
        ownerUserId: authed.doc._id,
      }).select('_id');
      product.categoryId = category?._id || null;
    } else if (body.categoryId === null || body.categoryId === '') {
      product.categoryId = null;
    }

    for (const key of ['name', 'sku', 'shortDescription', 'description']) {
      if (body[key] !== undefined) product[key] = String(body[key]).trim();
    }
    if (body.slug !== undefined) product.slug = storeSlug(body.slug || product.name);
    if (body.price !== undefined) product.priceInPaise = rupeesToPaise(body.price);
    if (body.salePrice !== undefined) {
      product.salePriceInPaise =
        body.salePrice === '' || body.salePrice === null ? null : rupeesToPaise(body.salePrice);
    }
    if (body.images !== undefined) product.images = cleanImages(body.images);
    if (body.stock !== undefined) product.stock = Math.max(0, Number(body.stock || 0));
    for (const key of ['trackInventory', 'isActive', 'isFeatured']) {
      if (body[key] !== undefined) product[key] = Boolean(body[key]);
    }
    if (body.minOrderQuantity !== undefined) {
      product.minOrderQuantity = Math.max(1, Number(body.minOrderQuantity || 1));
    }

    await product.save();

    let projectionSynced = true;
    try {
      await syncStoreProductProjection(product);
    } catch (projectionError: any) {
      projectionSynced = false;
      logger.warn('[store] Product updated but SMB projection sync failed: ' + (projectionError?.message || projectionError));
    }

    return NextResponse.json({ success: true, data: product, projectionSynced });
  } catch (error) {
    return errorResponse(error, 'Failed to update product');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: true });
    }

    const deleted: any = await StoreProduct.findOneAndDelete({ _id: id, ownerUserId: authed.doc._id });
    if (deleted) {
      await removeStoreProductProjection(authed.doc._id, deleted._id).catch((projectionError: any) =>
        logger.warn('[store] Product deleted but SMB projection cleanup failed: ' + (projectionError?.message || projectionError))
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to delete product');
  }
}
