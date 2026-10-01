import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import StoreProduct from '@/lib/models/StoreProduct';
import StoreCategory from '@/lib/models/StoreCategory';
import { cleanImages, rupeesToPaise, storeSlug } from '@/lib/store/helpers';
import { syncStoreProductProjection } from '@/lib/store/syncProductToSmb';
import logger from '@/lib/utils/logger';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const data = await StoreProduct.find({ ownerUserId: authed.doc._id })
      .sort({ createdAt: -1 })
      .populate('categoryId', 'name slug')
      .lean();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to load products');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const name = String(body.name || '').trim();

    if (!name) {
      return NextResponse.json({ success: false, message: 'Product name is required' }, { status: 400 });
    }

    let categoryId = null;
    if (body.categoryId && mongoose.isValidObjectId(body.categoryId)) {
      const category = await StoreCategory.findOne({
        _id: body.categoryId,
        ownerUserId: authed.doc._id,
      }).select('_id');
      categoryId = category?._id || null;
    }

    const data = await StoreProduct.create({
      ownerUserId: authed.doc._id,
      tenantId: authed.tenantId || null,
      categoryId,
      name,
      slug: storeSlug(body.slug || name),
      sku: String(body.sku || '').trim(),
      shortDescription: String(body.shortDescription || '').trim(),
      description: String(body.description || '').trim(),
      priceInPaise: rupeesToPaise(body.price),
      salePriceInPaise:
        body.salePrice === '' || body.salePrice == null ? null : rupeesToPaise(body.salePrice),
      images: cleanImages(body.images),
      tags: Array.isArray(body.tags)
        ? body.tags.map(String).slice(0, 20)
        : String(body.tags || '').split(',').map((item: string) => item.trim()).filter(Boolean).slice(0, 20),
      stock: Math.max(0, Number(body.stock || 0)),
      trackInventory: body.trackInventory !== false,
      minOrderQuantity: Math.max(1, Number(body.minOrderQuantity || 1)),
      isActive: body.isActive !== false,
      isFeatured: Boolean(body.isFeatured),
    });

    let projectionSynced = true;
    try {
      await syncStoreProductProjection(data);
    } catch (projectionError: any) {
      projectionSynced = false;
      logger.warn('[store] Product saved but SMB projection sync failed: ' + (projectionError?.message || projectionError));
    }

    return NextResponse.json({ success: true, data, projectionSynced }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'Product address or SKU is already in use' },
        { status: 409 }
      );
    }
    return errorResponse(error, 'Failed to create product');
  }
}
