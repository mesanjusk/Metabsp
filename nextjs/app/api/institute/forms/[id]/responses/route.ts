import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteForm, InstituteFormResponse } from '@/lib/models';
import { instituteScope } from '@/lib/institute/idCards';

function refFilter(id:string){const v=String(id||'').trim();return mongoose.isValidObjectId(v)?{$or:[{_id:v},{formUuid:v}]}:{formUuid:v};}
export async function GET(req:NextRequest,context:{params:Promise<{id:string}>}){try{await connectDB();const authed=await requireAuth(req);const{id}=await context.params;const form:any=await InstituteForm.findOne({...instituteScope(authed),archived:{$ne:true},...refFilter(id)}).lean();if(!form)return NextResponse.json({success:false,message:'Form not found'},{status:404});const rows:any[]=await InstituteFormResponse.find({formId:form._id}).sort({createdAt:-1}).limit(500).lean();return NextResponse.json({success:true,data:rows.map(r=>({_id:String(r._id),response_uuid:r.responseUuid,data:r.data||{},createdAt:r.createdAt}))});}catch(error){return errorResponse(error,'Failed to load form responses');}}
