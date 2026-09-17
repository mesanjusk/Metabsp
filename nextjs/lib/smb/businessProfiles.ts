export const BUSINESS_TYPES = [
  { value: 'retail_ecommerce', label: 'Retail / E-commerce' },
  { value: 'services_agency', label: 'Service business / Agency' },
  { value: 'education', label: 'School / Institute / Coaching' },
  { value: 'hospitality', label: 'Hotel / Restaurant / Cafe' },
  { value: 'healthcare', label: 'Clinic / Hospital / Medical' },
  { value: 'real_estate_interior', label: 'Real estate / Interior / Construction' },
  { value: 'wedding_events', label: 'Wedding / Events' },
  { value: 'professional_services', label: 'Professional services' },
  { value: 'other', label: 'Other business' },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]['value'];

const CORE = ['whatsapp', 'crm', 'google-business'];

export const SERVICE_RECOMMENDATIONS: Record<BusinessType, string[]> = {
  retail_ecommerce: [...CORE, 'store', 'payments', 'marketing', 'staff', 'instagram'],
  services_agency: [...CORE, 'payments', 'staff', 'marketing', 'instagram', 'video', 'dialer'],
  education: [...CORE, 'institute', 'payments', 'staff', 'marketing'],
  hospitality: [...CORE, 'store', 'marketing', 'instagram', 'staff', 'payments'],
  healthcare: [...CORE, 'staff', 'payments', 'marketing'],
  real_estate_interior: [...CORE, 'dialer', 'staff', 'payments', 'marketing', 'instagram'],
  wedding_events: [...CORE, 'store', 'marketing', 'instagram', 'video', 'staff', 'payments'],
  professional_services: [...CORE, 'payments', 'staff', 'dialer', 'marketing'],
  other: [...CORE, 'payments', 'staff', 'marketing'],
};

export function isBusinessType(value: unknown): value is BusinessType {
  return BUSINESS_TYPES.some((item) => item.value === value);
}

export function recommendedServices(type: BusinessType | null | undefined) {
  return type ? SERVICE_RECOMMENDATIONS[type] || SERVICE_RECOMMENDATIONS.other : [];
}
