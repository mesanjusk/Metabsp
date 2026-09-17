import crypto from 'crypto';
import StoreProfile from '@/lib/models/StoreProfile';
import { publicStoreUrls, storeSlug, STORE_DOMAIN_CNAME_TARGET } from './helpers';

function safeDefaultName(user: any) {
  const name = String(user?.name || '').trim();
  const mobile = String(user?.mobile || '').replace(/\D/g, '');
  return name && name.replace(/\D/g, '') !== mobile ? name : 'My Store';
}

export async function ensureStoreProfile(user: any, tenantId: string | null = null) {
  const existing: any = await StoreProfile.findOne({ ownerUserId: user._id });
  if (existing) return existing;
  const name = safeDefaultName(user);
  const base = name === 'My Store' ? `store-${String(user._id).slice(-6)}` : storeSlug(name);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt ? `${base}-${String(user._id).slice(-4)}${attempt}` : base;
    try {
      return await StoreProfile.create({ ownerUserId: user._id, tenantId: tenantId || null, name, slug });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const raced = await StoreProfile.findOne({ ownerUserId: user._id });
      if (raced) return raced;
    }
  }
  return StoreProfile.create({ ownerUserId: user._id, tenantId: tenantId || null, name, slug: `store-${crypto.randomBytes(5).toString('hex')}` });
}

export function storeProfileResponse(profile: any) {
  const value = typeof profile?.toObject === 'function' ? profile.toObject() : { ...profile };
  delete value.domainVerificationToken;
  return { ...value, ...publicStoreUrls(value.slug, value.customDomain, value.domainStatus), domainCnameTarget: STORE_DOMAIN_CNAME_TARGET };
}
