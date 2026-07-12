# Brokie OS — Founders Collection Builder

This build adds a focused bulk product workflow for the first five Brokie products:

1. We Don't Need Money Heavyweight Tee
2. Dangerous Statement Hoodie
3. Built Different Heavyweight Tee
4. Backed by Loyalty Tee
5. Brokie Mascot Embroidered Hat

## Install

```bash
cd ~/Downloads/brokie-os-founders-builder
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Configure Printful

Add to `.env.local`:

```text
PRINTFUL_TOKEN=your_token
PRINTFUL_STORE_ID=your_store_id
```

Your token needs permission to write synced products.

## Use it safely

1. Select only the manifesto tee.
2. Enter one real Printful catalog variant ID.
3. Enter a public HTTPS front artwork URL.
4. Add the back artwork URL when the product uses a back print.
5. Click **Dry Test** and inspect the payload.
6. Click **Create in Printful** only after the dry test succeeds.
7. Verify the product in Printful and Shopify before creating the other products.

## Important

- The included logo images are visual brand assets, not guaranteed print-ready transparent artwork.
- Printful must be able to retrieve your artwork from a public HTTPS URL.
- Exact Printful variant IDs depend on the blank product, size, color, and fulfillment region.
- Hat files may require embroidery-specific artwork and digitization.
- Product creation uses Printful's synced-product endpoint. Printful currently documents sync-product management in its legacy API, while v2 product sync management is not yet available.
