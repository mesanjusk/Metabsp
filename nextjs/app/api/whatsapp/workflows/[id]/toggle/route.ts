import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import Workflow from '@/lib/models/Workflow';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const workflow: any = await Workflow.findOne({ _id: id, userId: authed.id });
    if (!workflow) throw new AppError('Workflow not found', 404);

    workflow.isActive = !workflow.isActive;
    await workflow.save();

    return NextResponse.json({ success: true, data: workflow });
  } catch (error) {
    return errorResponse(error, 'Failed to toggle workflow');
  }
}
