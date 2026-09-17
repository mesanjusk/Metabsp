'use client';
import PageBody from '@/lib/ui/app/PageBody';import StoreManager from '@/lib/ui/store/StoreManager';
export default function Page(){return <PageBody title="Products" description="Manage products, pricing, images and stock."><StoreManager mode="products"/></PageBody>}
