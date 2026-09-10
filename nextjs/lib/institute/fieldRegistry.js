export const INSTITUTE_FIELDS = {
  students: [
    ['firstName','First name','text',true], ['middleName','Middle name','text'], ['lastName','Last name','text'],
    ['regNo','Registration no.','text'], ['dob','Date of birth','date'], ['gender','Gender','select',false,['Male','Female','Other']],
    ['mobileSelf','Student mobile','tel'], ['mobileParent','Parent mobile','tel'], ['mothersName','Mother name','text'],
    ['aadharNo','Aadhaar no.','text'], ['education','Education','text'], ['schoolName','School name','text'], ['address','Address','textarea'],
  ],
  courses: [['name','Course name','text',true],['description','Description','textarea'],['courseFees','Course fees','number'],['examFees','Exam fees','number'],['duration','Duration','text']],
  'course-categories': [['category','Category','text',true],['description','Description','textarea']],
  batches: [['name','Batch name','text',true],['timing','Timing','text']],
  education: [['education','Education / class','text',true],['description','Description','textarea']],
  exams: [['exam','Exam','text',true],['description','Description','textarea']],
  attendance: [['User_uuid','Student/User ID','text',true],['Date','Date','date',true],['Status','Status','select',true,['Present','Absent','Late','Leave']],['Attendance_Record_ID','Record ID','number']],
  leads: [['student_uuid','Student ID','text'],['course','Course','text'],['branchCode','Branch/center','text'],['enquiryDate','Enquiry date','date'],['followupDate','Follow-up date','date'],['referredBy','Referred by','text'],['score','Lead score','select',false,['hot','warm','cold']],['source','Source','select',false,['walk_in','referral','website','social_media','phone','other']],['assignedTo','Assigned to','text']],
  followups: [['student_uuid','Student/Lead ID','text'],['date','Follow-up date','date',true],['note','Note','textarea'],['status','Status','select',false,['follow-up','converted','lost']],['assignedTo','Assigned to','text']],
  admissions: [['student_uuid','Student ID','text',true],['admissionDate','Admission date','date'],['course','Course','text',true],['batchTime','Batch time','text'],['examEvent','Exam event','text'],['confirmationStatus','Status','select',false,['','Confirmed','DropOut']],['dropoutReason','Dropout reason','textarea']],
  fees: [['student_uuid','Student ID','text',true],['admission_uuid','Admission ID','text'],['fees','Fees','number',true],['discount','Discount','number'],['total','Total','number',true],['feePaid','Fee paid','number'],['paidBy','Paid by','text'],['balance','Balance','number',true],['emi','EMI','number'],['installment','Installment','text']],
  receipts: [['student_uuid','Student ID','text',true],['date','Receipt date','date'],['amount','Amount','number',true],['paymentMode','Payment mode','text'],['reference','Reference','text'],['note','Note','textarea']],
  payments: [['date','Payment date','date'],['account','Account','text'],['amount','Amount','number',true],['paymentMode','Payment mode','text'],['reference','Reference','text'],['note','Note','textarea']],
  'payment-modes': [['name','Payment mode','text',true],['description','Description','textarea']],
  accounts: [['name','Account name','text',true],['accountGroup','Account group','text'],['openingBalance','Opening balance','number'],['type','Type','select',false,['asset','liability','income','expense','other']],['description','Description','textarea']],
  'account-groups': [['name','Group name','text',true],['type','Type','text'],['description','Description','textarea']],
  transactions: [['date','Date','date'],['type','Type','select',true,['income','expense','receipt','payment','transfer']],['account','Account','text'],['amount','Amount','number',true],['reference','Reference','text'],['description','Description','textarea']],
  employees: [['firstName','First name','text',true],['lastName','Last name','text'],['designation','Designation','text'],['department','Department','text'],['mobile','Mobile','tel'],['email','Email','email'],['joiningDate','Joining date','date'],['status','Status','select',false,['active','inactive']],['bankAccount','Bank account','text'],['ifsc','IFSC','text'],['pan','PAN','text']],
  institutes: [['institute_name','Institute name','text',true],['branchCode','Branch code','text'],['mobile','Mobile','tel'],['email','Email','email'],['address','Address','textarea'],['city','City','text'],['state','State','text'],['pincode','PIN code','text']],
  owners: [['name','Owner name','text',true],['mobile','Mobile','tel'],['email','Email','email'],['designation','Designation','text']],
  'organization-categories': [['category','Category','text',true],['description','Description','textarea']],
  forms: [['name','Form name','text',true],['slug','Public slug','text'],['description','Description','textarea'],['status','Status','select',false,['active','inactive']]],
  'form-responses': [['formId','Form ID','text',true],['name','Name','text'],['phone','Phone','tel'],['email','Email','email'],['response','Response','textarea']],
  designs: [['name','Design / project name','text',true],['type','Type','select',false,['id-card','certificate','canvas','other']],['template','Template / JSON','textarea']],
  'custom-templates': [['name','Template name','text',true],['type','Type','text'],['content','Template content','textarea']],
  greetings: [['title','Title','text',true],['occasion','Occasion','text'],['message','Message','textarea'],['imageUrl','Image URL','url']],
};

export function fieldsForResource(resource) {
  return INSTITUTE_FIELDS[resource] || [['name','Name','text',true],['description','Description','textarea']];
}
