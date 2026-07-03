export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function fallbackHandle(title: string, salt: string): string {
  const base = slugify(title);
  const short = salt.slice(-6);
  return base ? `${base}-${short}` : `product-${short}`;
}
