import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductForm, { type ProductFormInitial } from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { include: { inventory: true }, orderBy: { createdAt: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!product) notFound();

  const initial: ProductFormInitial = {
    id: product.id,
    title: product.title,
    titleHe: product.titleHe ?? "",
    author: product.author ?? "",
    series: product.series ?? "",
    descriptionHtml: product.descriptionHtml ?? "",
    status: product.status,
    voiceCode: product.voiceCode ?? "",
    variants: product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode ?? "",
      priceCents: String(v.priceCents),
      compareAtCents: v.compareAtCents == null ? "" : String(v.compareAtCents),
      weightGrams: v.weightGrams == null ? "" : String(v.weightGrams),
      active: v.active,
      onHand: v.inventory?.onHand ?? 0,
      initialOnHand: "0",
    })),
    images: product.images.map((img) => ({
      id: img.id,
      url: img.url,
      altText: img.altText ?? "",
      position: String(img.position),
    })),
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{product.title}</h1>
        <p className="text-xs text-gray-500">ID: {product.id}</p>
      </div>
      <ProductForm initial={initial} />
    </div>
  );
}
