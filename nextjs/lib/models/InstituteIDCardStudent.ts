import mongoose, { Schema } from 'mongoose';

const instituteIDCardStudentSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    idcardUuid: { type: String, required: true, unique: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'InstituteIDCardProject', required: true, index: true },
    studentRecordId: { type: Schema.Types.ObjectId, ref: 'InstituteRecord', default: null, index: true },
    className: { type: String, default: '' },
    section: { type: String, default: '' },
    rollNumber: { type: String, default: '' },
    studentName: { type: String, required: true, trim: true },
    extraFields: { type: Schema.Types.Mixed, default: {} },
    photoUrl: { type: String, default: '' },
    bgRemovedUrl: { type: String, default: '' },
    useBgRemoved: { type: Boolean, default: false },
    photoSource: { type: String, enum: ['', 'bulk_upload', 'teacher', 'webcam', 'student'], default: '' },
    cardStatus: { type: String, enum: ['pending', 'not_available', 'student_submitted', 'approved'], default: 'pending', index: true },
    magicToken: { type: String, default: '', index: true },
    magicTokenExpires: { type: Date, default: null },
    studentNameOverride: { type: String, default: '' },
    studentPhotoUrl: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

instituteIDCardStudentSchema.index({ projectId: 1, className: 1, rollNumber: 1 });

export const InstituteIDCardStudent =
  (mongoose.models.InstituteIDCardStudent as any) ||
  mongoose.model('InstituteIDCardStudent', instituteIDCardStudentSchema);

export default InstituteIDCardStudent;
