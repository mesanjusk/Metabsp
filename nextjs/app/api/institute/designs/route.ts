import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteDesign } from '@/lib/models';
import { defaultIdCardCanvas, instituteScope } from '@/lib/institute/idCards';

function dto(row: any) {
  return {
    _id: String(row._id), design_uuid: row.designUuid, name: row.name, docType: row.docType,
    width: row.width, height: row.height, canvas: row.canvas || {}, thumbnail: row.thumbnail || '',
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const url = new URL(req.url);
    const docType = String(url.searchParams.get('docType') || '');
    const filter: any = { ...instituteScope(authed), archived: { $ne: true } };
    if (docType) filter.docType = docType;
    const rows: any[] = await InstituteDesign.find(filter).sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ success: true, data: rows.map(dto) });
  } catch (error) { return errorResponse(error, 'Failed to load designs'); }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body: any = await req.json().catch(() => ({}));
    const docType = ['id_card','certificate','result','admit_card'].includes(body.docType) ? body.docType : 'id_card';
    const row = await InstituteDesign.create({
      ...instituteScope(authed), ownerUserId: authed.id, designUuid: randomUUID(),
      name: String(body.name || 'Untitled Design'), docType,
      width: Math.max(100, Number(body.width || 324)), height: Math.max(100, Number(body.height || 204)),
      canvas: body.canvas || defaultIdCardCanvas(), thumbnail: String(body.thumbnail || ''), createdBy: authed.id,
    });
    return NextResponse.json({ success: true, data: dto(row) }, { status: 201 });
  } catch (error) { return errorResponse(error, 'Failed to create design'); }
}
