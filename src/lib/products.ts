import { z } from "zod";

export const variantInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().nullish(),
  priceCents: z.number().int().nonnegative(),
  compareAtCents: z.number().int().nonnegative().nullish(),
  weightGrams: z.number().int().nonnegative().nullish(),
  active: z.boolean().optional().default(true),
  initialOnHand: z.number().int().nonnegative().optional(),
});

export const imageInput = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  altText: z.string().nullish(),
  position: z.number().int().nonnegative().optional().default(0),
});

export const productCreateSchema = z.object({
  title: z.string().min(1),
  titleHe: z.string().nullish(),
  author: z.string().nullish(),
  series: z.string().nullish(),
  descriptionHtml: z.string().nullish(),
  status: z.enum(["draft", "active"]).optional().default("draft"),
  voiceCode: z.string().nullish(),
  variants: z.array(variantInput).default([]),
  images: z.array(imageInput).default([]),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  variants: z.array(variantInput).optional(),
  images: z.array(imageInput).optional(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
