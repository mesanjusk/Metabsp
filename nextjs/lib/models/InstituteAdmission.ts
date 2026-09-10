import mongoose, { Schema } from 'mongoose';

const InstituteAdmissionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    admissionUuid: { type: String, required: true, index: true },
    studentRecordId: { type: Schema.Types.ObjectId, ref: 'InstituteRecord', required: true, index: true },
    studentLegacyId: { type: String, default: '', index: true },
    admissionDate: { type: Date, default: Date.now, index: true },
    course: { type: String, required: true, trim: true, index: true },
    batchTime: { type: String, default: '', trim: true },
    examEvent: { type: String, default: '', trim: true },
    confirmationStatus: { type: String, enum: ['', 'Confirmed', 'DropOut'], default: '', index: true },
    dropoutReason: { type: String, default: '', trim: true },
    sourceLeadRecordId: { type: Schema.Types.ObjectId, ref: 'InstituteRecord', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'institute_admissions' }
);

InstituteAdmissionSchema.index({ tenantId: 1, admissionUuid: 1 }, { unique: true });
InstituteAdmissionSchema.index({ tenantId: 1, studentRecordId: 1, admissionDate: -1 });
InstituteAdmissionSchema.index({ ownerUserId: 1, admissionUuid: 1 }, { unique: true });

export const InstituteAdmission =
  (mongoose.models.InstituteAdmission as any) || mongoose.model('InstituteAdmission', InstituteAdmissionSchema);

export default InstituteAdmission;
