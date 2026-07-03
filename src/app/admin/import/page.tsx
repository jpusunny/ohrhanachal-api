import ImportCsvClient from "./ImportCsvClient";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Import catalog CSV</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload a Shopify-format products_export.csv. First upload runs a dry-run and shows what
          would change; then you can apply. Imports are idempotent by SKU — existing variants are
          skipped, new images are added.
        </p>
      </div>
      <ImportCsvClient />
    </div>
  );
}
