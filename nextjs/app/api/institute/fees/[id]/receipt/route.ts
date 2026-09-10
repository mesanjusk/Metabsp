import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteAdmission, InstituteFee, InstituteRecord } from '@/lib/models';
import { feeApiItem, instituteScope, normalizeMoney } from '@/lib/institute/nativeAdmissions';

function feeFilter(id: string) {
  const value = String(id || '').trim();
  return mongoose.isValidObjectId(value) ? { $or: [{ _id: value }, { feeUuid: value }] } : { feeUuid: value };
}
function legacyFilter(id: string) {
  const value = String(id || '').trim(); const ors:any[]=[{legacyId:value},{'payload.uuid':value}]; if(mongoose.isValidObjectId(value)) ors.unshift({_id:value}); return {$or:ors};
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB(); const authed=await requireAuth(req); const {id}=await context.params; const body:any=await req.json().catch(()=>({})); const amount=normalizeMoney(body.amount);
    if(amount<=0) return NextResponse.json({success:false,message:'Receipt amount must be greater than zero'},{status:400});
    const fee:any=await InstituteFee.findOne({...instituteScope(authed),archived:{$ne:true},...feeFilter(id)});
    const receipt={receiptNo:String(body.receiptNo||`RCPT-${Date.now()}`),amount,paidAt:body.paidAt?new Date(body.paidAt):new Date(),paymentMode:String(body.paymentMode||body.paidBy||''),reference:String(body.reference||''),note:String(body.note||''),createdBy:authed.id};
    if(!fee){
      const legacy:any=await InstituteRecord.findOne({...instituteScope(authed),entityType:'fees',archived:{$ne:true},...legacyFilter(id)});
      if(!legacy) return NextResponse.json({success:false,message:'Fee plan not found'},{status:404});
      const p={...(legacy.payload||{})}; const balance=normalizeMoney(p.balance); if(amount>balance) return NextResponse.json({success:false,message:'Receipt amount cannot exceed outstanding balance'},{status:400});
      p.receipts=[...(Array.isArray(p.receipts)?p.receipts:[]),receipt]; p.feePaid=normalizeMoney(Number(p.feePaid||0)+amount); p.balance=normalizeMoney(Number(p.total||p.fees||0)-p.feePaid); p.paidBy=receipt.paymentMode||p.paidBy||''; legacy.payload=p; await legacy.save();
      return NextResponse.json({success:true,data:{...legacy.toObject(),_id:String(legacy._id),source:legacy.source||'legacy'},receipt},{status:201});
    }
    if(amount>normalizeMoney(fee.balance)) return NextResponse.json({success:false,message:'Receipt amount cannot exceed outstanding balance'},{status:400});
    fee.receipts.push(receipt); fee.feePaid=normalizeMoney(Number(fee.feePaid||0)+amount); fee.balance=normalizeMoney(Number(fee.total||0)-fee.feePaid); fee.paidBy=receipt.paymentMode||fee.paidBy;
    let remaining=amount; for(const row of fee.installmentPlan||[]){if(remaining<=0)break; const outstanding=normalizeMoney(Number(row.amount||0)-Number(row.paidAmount||0)); if(outstanding<=0)continue; const applied=Math.min(outstanding,remaining); row.paidAmount=normalizeMoney(Number(row.paidAmount||0)+applied); remaining=normalizeMoney(remaining-applied); row.status=row.paidAmount>=row.amount?'paid':'partial'; if(row.status==='paid')row.paidAt=receipt.paidAt;}
    fee.updatedBy=authed.id; await fee.save(); const [student,admission]=await Promise.all([InstituteRecord.findById(fee.studentRecordId).lean(),InstituteAdmission.findById(fee.admissionId).lean()]);
    return NextResponse.json({success:true,data:feeApiItem(fee.toObject(),student,admission),receipt:fee.receipts[fee.receipts.length-1]},{status:201});
  } catch(error){return errorResponse(error,'Failed to record fee receipt');}
}
