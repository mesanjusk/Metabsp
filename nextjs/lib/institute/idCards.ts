import crypto from 'crypto';

export function instituteScope(authed: any) {
  return authed.tenantId ? { tenantId: authed.tenantId } : { tenantId: null, ownerUserId: authed.id };
}

export function idCardPublicBaseUrl(req: Request) {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function createMagicToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function projectDto(project: any, studentCount?: number) {
  return {
    _id: String(project._id),
    project_uuid: project.projectUuid,
    title: project.title,
    academic_year: project.academicYear || '',
    design_id: project.designId ? String(project.designId) : null,
    principal_signature_url: project.principalSignatureUrl || '',
    status: project.status || 'active',
    student_count: Number(studentCount || 0),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function studentDto(student: any) {
  return {
    _id: String(student._id),
    idcard_uuid: student.idcardUuid,
    project_id: String(student.projectId),
    student_record_id: student.studentRecordId ? String(student.studentRecordId) : null,
    class_name: student.className || '',
    section: student.section || '',
    roll_number: student.rollNumber || '',
    student_name: student.studentName || '',
    display_name: student.studentNameOverride || student.studentName || '',
    extra_fields: student.extraFields || {},
    photo_url: student.photoUrl || '',
    bg_removed_url: student.bgRemovedUrl || '',
    active_photo_url: student.useBgRemoved && student.bgRemovedUrl ? student.bgRemovedUrl : student.photoUrl || '',
    use_bg_removed: Boolean(student.useBgRemoved),
    photo_source: student.photoSource || '',
    card_status: student.cardStatus || 'pending',
    submitted_at: student.submittedAt || null,
    approved_at: student.approvedAt || null,
    magic_token_expires: student.magicTokenExpires || null,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

export function normalizeImportedStudent(input: any) {
  const pick = (keys: string[]) => {
    for (const key of keys) {
      const value = input?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  };
  return {
    studentName: pick(['student_name', 'name', 'Name', 'Student Name']) || 'Unknown',
    rollNumber: pick(['roll_number', 'roll', 'Roll', 'Roll No', 'Roll Number']),
    className: pick(['class_name', 'class', 'Class', 'Class Name']),
    section: pick(['section', 'Section']),
    extraFields: input || {},
  };
}

export function defaultIdCardCanvas() {
  return {
    background: '#ffffff',
    elements: [
      { id: 'photo', type: 'photo', x: 112, y: 28, width: 100, height: 100, radius: 8, field: 'active_photo_url' },
      { id: 'name', type: 'text', x: 32, y: 144, width: 260, text: '{{student_name}}', fontSize: 20, fontWeight: 700, align: 'center' },
      { id: 'class', type: 'text', x: 32, y: 174, width: 260, text: 'Class: {{class_name}}   Roll: {{roll_number}}', fontSize: 12, align: 'center' },
    ],
  };
}
