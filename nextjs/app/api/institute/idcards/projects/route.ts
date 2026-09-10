import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteIDCardProject, InstituteIDCardStudent } from '@/lib/models';
import { instituteScope, projectDto } from '@/lib/institute/idCards';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const projects: any[] = await InstituteIDCardProject.find({ ...instituteScope(authed), archived: { $ne: true } }).sort({ createdAt: -1 }).lean();
    const ids = projects.map((p) => p._id);
    const counts = await InstituteIDCardStudent.aggregate([
      { $match: { projectId: { $in: ids }, archived: { $ne: true } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]);
    const byId = new Map<string, number>(counts.map((x: any) => [String(x._id), Number(x.count || 0)] as [string, number]));
    return NextResponse.json({ success: true, data: projects.map((p) => projectDto(p, Number(byId.get(String(p._id)) || 0))) });
  } catch (error) {
    return errorResponse(error, 'Failed to load ID card projects');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body: any = await req.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ success: false, message: 'Project title is required' }, { status: 400 });
    const project = await InstituteIDCardProject.create({
      ...instituteScope(authed),
      ownerUserId: authed.id,
      projectUuid: randomUUID(),
      title,
      academicYear: String(body.academic_year || body.academicYear || ''),
      designId: body.design_id || body.designId || null,
      principalSignatureUrl: String(body.principal_signature_url || body.principalSignatureUrl || ''),
      createdBy: authed.id,
    });
    return NextResponse.json({ success: true, data: projectDto(project) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create ID card project');
  }
}
