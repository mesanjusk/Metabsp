import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteForm, InstituteFormResponse } from '@/lib/models';
import { instituteScope, idCardPublicBaseUrl } from '@/lib/institute/idCards';

function slugify(value: string) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function dto(row: any, baseUrl = '', responseCount = 0) {
  return { _id:String(row._id), form_uuid:row.formUuid, title:row.title, description:row.description||'', slug:row.slug, fields:row.fields||[], isActive:Boolean(row.isActive), successMessage:row.successMessage, createLead:Boolean(row.createLead), publicUrl:baseUrl?`${baseUrl}/forms/${row.slug}`:'', responseCount, createdAt:row.createdAt, updatedAt:row.updatedAt };
}

export async function GET(req: NextRequest) {
  try {
    await connectDB(); const authed=await requireAuth(req); const scope=instituteScope(authed);
    const rows:any[]=await InstituteForm.find({...scope,archived:{$ne:true}}).sort({updatedAt:-1}).lean();
    const ids=rows.map(r=>r._id); const counts=await InstituteFormResponse.aggregate([{ $match:{formId:{$in:ids}} },{$group:{_id:'$formId',count:{$sum:1}}}]); const map=new Map(counts.map((x:any)=>[String(x._id),x.count]));
    const base=idCardPublicBaseUrl(req); return NextResponse.json({success:true,data:rows.map(r=>dto(r,base,map.get(String(r._id))||0))});
  } catch(error){return errorResponse(error,'Failed to load forms');}
}

export async function POST(req: NextRequest) {
  try {
    await connectDB(); const authed=await requireAuth(req); const body:any=await req.json().catch(()=>({}));
    const title=String(body.title||'').trim(); if(!title)return NextResponse.json({success:false,message:'Form title is required'},{status:400});
    let slug=slugify(body.slug||title); if(!slug)slug=`form-${Date.now()}`;
    const scope=instituteScope(authed); const exists=await InstituteForm.exists({slug,archived:{$ne:true}}); if(exists)slug=`${slug}-${randomUUID().slice(0,8)}`;
    const fields=(Array.isArray(body.fields)?body.fields:[]).map((f:any,i:number)=>({fieldUuid:f.fieldUuid||randomUUID(),label:String(f.label||`Field ${i+1}`),name:slugify(f.name||f.label||`field-${i+1}`).replaceAll('-','_'),type:['text','email','phone','number','textarea','dropdown','radio','checkbox','date'].includes(f.type)?f.type:'text',options:Array.isArray(f.options)?f.options.map(String):[],required:Boolean(f.required),order:i}));
    const row=await InstituteForm.create({...scope,ownerUserId:authed.id,formUuid:randomUUID(),title,description:String(body.description||''),slug,fields,isActive:body.isActive!==false,successMessage:String(body.successMessage||'Thank you! Your response has been recorded.'),createLead:body.createLead!==false,createdBy:authed.id});
    return NextResponse.json({success:true,data:dto(row,idCardPublicBaseUrl(req))},{status:201});
  } catch(error){return errorResponse(error,'Failed to create form');}
}
