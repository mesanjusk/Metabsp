import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { InstituteIDCardProject, InstituteIDCardStudent, InstituteDesign } from '@/lib/models';
import { studentDto } from '@/lib/institute/idCards';

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  await connectDB();
  const { token } = await context.params;
  const student: any = await InstituteIDCardStudent.findOne({ magicToken: token, archived: { $ne: true } }).lean();
  if (!student) return NextResponse.json({ success: false, message: 'Invalid or expired link' }, { status: 404 });
  if (!student.magicTokenExpires || new Date(student.magicTokenExpires) < new Date()) return NextResponse.json({ success: false, message: 'This magic link has expired' }, { status: 410 });
  const project: any = await InstituteIDCardProject.findById(student.projectId).lean();
  const design: any = project?.designId ? await InstituteDesign.findById(project.designId).lean() : null;
  return NextResponse.json({ success: true, data: { student: studentDto(student), project: project ? { title: project.title, academic_year: project.academicYear, principal_signature_url: project.principalSignatureUrl } : null, design: design ? { name: design.name, width: design.width, height: design.height, canvas: design.canvas } : null } });
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  await connectDB();
  const { token } = await context.params;
  const student: any = await InstituteIDCardStudent.findOne({ magicToken: token, archived: { $ne: true } });
  if (!student) return NextResponse.json({ success: false, message: 'Invalid or expired link' }, { status: 404 });
  if (!student.magicTokenExpires || student.magicTokenExpires < new Date()) return NextResponse.json({ success: false, message: 'This magic link has expired' }, { status: 410 });
  const body: any = await req.json().catch(() => ({}));
  if (body.student_name_override !== undefined) student.studentNameOverride = String(body.student_name_override || '');
  if (body.photo_url !== undefined) { student.studentPhotoUrl = String(body.photo_url || ''); student.photoUrl = String(body.photo_url || ''); student.photoSource = 'student'; }
  student.cardStatus = 'student_submitted'; student.submittedAt = new Date(); await student.save();
  return NextResponse.json({ success: true, message: 'Submitted successfully. Your card is under review.', data: studentDto(student) });
}
