import { shopifyGraphQL } from "@/lib/shopify";

const PUBLICATIONS_QUERY = `
query BrokiePublications {
  publications(first: 50) {
    nodes {
      id
      autoPublish
      supportsFuturePublishing
      catalog {
        id
        title
      }
    }
  }
}`;

const PUBLISH_MUTATION = `
mutation PublishBrokieResource($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    publishable {
      ... on Product {
        id
        title
        status
        onlineStoreUrl
        resourcePublicationsCount { count }
      }
      ... on Collection {
        id
        title
        handle
      }
    }
    userErrors { field message }
  }
}`;

const PRODUCT_STATE_QUERY = `
query BrokieProductState($id: ID!) {
  product(id: $id) {
    id
    title
    status
    onlineStoreUrl
    resourcePublications(first: 20) {
      nodes {
        publication {
          id
          catalog { title }
        }
        isPublished
        publishDate
      }
    }
  }
}`;

function userErrorMessage(payload, key) {
  const errors = payload?.[key]?.userErrors || [];
  return errors.map((error) => error.message).join("; ");
}

export async function findOnlineStorePublication() {
  const explicit = process.env.SHOPIFY_ONLINE_STORE_PUBLICATION_ID?.trim();
  if (explicit) {
    return {
      id: explicit,
      title: "Online Store",
      source: "environment"
    };
  }

  const data = await shopifyGraphQL(PUBLICATIONS_QUERY);
  const nodes = data.publications?.nodes || [];
  const match =
    nodes.find((node) =>
      String(node.catalog?.title || "").toLowerCase() === "online store"
    ) ||
    nodes.find((node) =>
      String(node.catalog?.title || "").toLowerCase().includes("online")
    );

  if (!match) {
    throw new Error(
      "The Online Store publication could not be found. Confirm the Online Store sales channel is installed and the app has read_publications access."
    );
  }

  return {
    id: match.id,
    title: match.catalog?.title || "Online Store",
    autoPublish: match.autoPublish,
    source: "shopify"
  };
}

export async function publishProductToOnlineStore(productId) {
  const result = await publishResourceToOnlineStore(productId);
  return { publication: result.publication, product: result.publishable };
}

export async function publishResourceToOnlineStore(resourceId) {
  const publication = await findOnlineStorePublication();

  const data = await shopifyGraphQL(PUBLISH_MUTATION, {
    id: resourceId,
    input: [{ publicationId: publication.id }]
  });

  const error = userErrorMessage(data, "publishablePublish");
  if (error) throw new Error(error);

  return {
    publication,
    publishable: data.publishablePublish.publishable
  };
}

export async function readShopifyProductState(productId) {
  const data = await shopifyGraphQL(PRODUCT_STATE_QUERY, { id: productId });
  if (!data.product) throw new Error("Shopify product was not found.");

  const publications = (data.product.resourcePublications?.nodes || []).map(
    (node) => ({
      id: node.publication?.id,
      title: node.publication?.catalog?.title || "Publication",
      published: Boolean(node.isPublished),
      publishDate: node.publishDate
    })
  );

  return {
    ...data.product,
    publications,
    onlineStorePublished: publications.some(
      (item) =>
        item.published &&
        String(item.title).toLowerCase() === "online store"
    )
  };
}
