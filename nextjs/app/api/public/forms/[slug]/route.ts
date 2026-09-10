import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { Contact, InstituteForm, InstituteFormResponse, InstituteRecord } from '@/lib/models';

function sanitizeData(fields:any[],data:any){const out:any={};for(const f of fields||[]){const v=data?.[f.name];if(f.required&&(v===undefined||v===null||v===''))throw new Error(`${f.label} is required`);out[f.name]=v??'';}return out;}
function normalizePhone(v:any){return String(v||'').replace(/\D/g,'');}

export async function GET(_req:NextRequest,context:{params:Promise<{slug:string}>}){
  await connectDB(); const{slug}=await context.params;
  const form:any=await InstituteForm.findOne({slug:String(slug).toLowerCase(),isActive:true,archived:{$ne:true}}).lean();
  if(!form)return NextResponse.json({success:false,message:'Form not found or inactive'},{status:404});
  return NextResponse.json({success:true,data:{title:form.title,description:form.description||'',fields:form.fields||[],successMessage:form.successMessage||''}});
}

export async function POST(req:NextRequest,context:{params:Promise<{slug:string}>}){
  try{
    await connectDB(); const{slug}=await context.params;
    const form:any=await InstituteForm.findOne({slug:String(slug).toLowerCase(),isActive:true,archived:{$ne:true}});
    if(!form)return NextResponse.json({success:false,message:'Form not found or inactive'},{status:404});
    const body:any=await req.json().catch(()=>({})); let data:any; try{data=sanitizeData(form.fields||[],body.data||body);}catch(e:any){return NextResponse.json({success:false,message:e.message},{status:400});}
    const response=await InstituteFormResponse.create({tenantId:form.tenantId||null,ownerUserId:form.ownerUserId,responseUuid:randomUUID(),formId:form._id,formUuid:form.formUuid,data,ip:req.headers.get('x-forwarded-for')||'',userAgent:req.headers.get('user-agent')||''});
    if(form.createLead){
      const name=String(data.name||data.student_name||data.full_name||data.first_name||'').trim(); const phone=normalizePhone(data.phone||data.mobile||data.mobileSelf||data.mobile_self);
      await InstituteRecord.create({tenantId:form.tenantId||null,ownerUserId:form.ownerUserId,entityType:'leads',legacyId:randomUUID(),source:'public-form',payload:{...data,source:'public_form',form_uuid:form.formUuid,enquiryDate:new Date(),score:'warm'},archived:false});
      if(phone){await Contact.findOneAndUpdate({userId:form.ownerUserId,phone},{$set:{name:name||phone,phone,category:'lead',customFields:{source:'public_form',form_uuid:form.formUuid}}},{upsert:true,new:true,setDefaultsOnInsert:true});}
    }
    return NextResponse.json({success:true,message:form.successMessage||'Thank you! Your response has been recorded.',response_uuid:response.responseUuid},{status:201});
  }catch(error:any){return NextResponse.json({success:false,message:error?.message||'Could not submit form'},{status:500});}
}
