import { z } from "zod";

export const COMMUNITY_SCHEMA_VERSION = "1.0";
export const COMMUNITY_SINGLETON = true;

const TEXT_LIMIT = 3500;
const URL_LIMIT = 1000;
const MAP_KEY_LIMIT = 48;
const MAP_ITEM_LIMIT = 20;
const INFO_KEYS = ["roadmap", "events", "giveaway", "truck", "gear"];

function cleanText(value) {
  return String(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}
function isPublicHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return false;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((part) => part > 255)) return false;
    const [a, b] = octets;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (host.includes(":")) {
    return !(
      host === "::" ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      /^fe[89ab]/.test(host) ||
      host.startsWith("::ffff:0:") ||
      host.startsWith("::ffff:127.") ||
      host.startsWith("::ffff:10.") ||
      host.startsWith("::ffff:192.168.")
    );
  }

  return true;
}

export function normalizePublicUrl(value) {
  const candidate = cleanText(value ?? "");
  if (!candidate || candidate.length > URL_LIMIT) return null;

  try {
    const url = new URL(candidate);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !isPublicHostname(url.hostname)
    ) {
      return null;
    }
    const normalized = url.toString();
    return normalized.length <= URL_LIMIT ? normalized : null;
  } catch {
    return null;
  }
}

function cleanNullableTextSchema(max) {
  return z
    .union([z.string(), z.null()])
    .transform((value) => cleanText(value ?? ""))
    .pipe(z.string().max(max))
    .transform((value) => value || null);
}

const publicUrlSchema = z
  .union([z.string(), z.null()])
  .refine(
    (value) =>
      value === null ||
      cleanText(value) === "" ||
      Boolean(normalizePublicUrl(value)),
    "URL must be a public http/https URL without credentials."
  )
  .transform((value) => normalizePublicUrl(value));

const mapKeySchema = z
  .string()
  .min(1)
  .max(MAP_KEY_LIMIT)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/, "Keys may only contain letters, numbers, spaces, dots, dashes, and underscores.");

export const OfficialUrlMapSchema = z
  .record(mapKeySchema, publicUrlSchema)
  .superRefine((items, context) => {
    if (Object.keys(items).length > MAP_ITEM_LIMIT) {
      context.addIssue({
        code: "custom",
        message: `Use no more than ${MAP_ITEM_LIMIT} links.`
      });
    }
    for (const [key, value] of Object.entries(items)) {
      if (value === null) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Link values cannot be empty."
        });
      }
    }
  })
  .transform((items) => Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b))));

const editableInfoSchema = z.strictObject({
  text: cleanNullableTextSchema(TEXT_LIMIT),
  url: publicUrlSchema
});

export const CommunityDiscordInputSchema = z.strictObject({
  live: z.strictObject({
    verified: z.boolean(),
    isLive: z.boolean(),
    title: cleanNullableTextSchema(256),
    url: publicUrlSchema
  }),
  info: z.strictObject(Object.fromEntries(INFO_KEYS.map((key) => [key, editableInfoSchema]))),
  links: OfficialUrlMapSchema,
  socials: OfficialUrlMapSchema,
  announcement: z.strictObject({
    enabled: z.boolean(),
    text: cleanNullableTextSchema(2000),
    url: publicUrlSchema
  })
}).superRefine((value, context) => {
  if (value.live.isLive && !value.live.verified) {
    context.addIssue({
      code: "custom",
      path: ["live", "isLive"],
      message: "Live status can only be active when it is verified."
    });
  }
  if (value.announcement.enabled && !value.announcement.text) {
    context.addIssue({
      code: "custom",
      path: ["announcement", "text"],
      message: "An enabled announcement needs text."
    });
  }
});

const publicInfoSchema = z.strictObject({
  verified: z.boolean(),
  text: z.string().nullable(),
  url: z.string().nullable()
});

const dropSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  price: z.number().nonnegative().nullable(),
  image: z.string().nullable()
});

export const CommunityDiscordFeedSchema = z.strictObject({
  ok: z.literal(true),
  schemaVersion: z.literal(COMMUNITY_SCHEMA_VERSION),
  sourceAvailable: z.boolean(),
  updatedAt: z.string().nullable(),
  live: z.strictObject({
    verified: z.boolean(),
    isLive: z.boolean(),
    title: z.string().nullable(),
    url: z.string().nullable()
  }),
  info: z.strictObject(Object.fromEntries(INFO_KEYS.map((key) => [key, publicInfoSchema]))),
  links: z.strictObject({
    verified: z.boolean(),
    items: z.record(z.string(), z.string())
  }),
  socials: z.strictObject({
    verified: z.boolean(),
    items: z.record(z.string(), z.string())
  }),
  announcement: z.strictObject({
    enabled: z.boolean(),
    id: z.string().nullable(),
    text: z.string().nullable(),
    url: z.string().nullable()
  }),
  drops: z.array(dropSchema),
  stats: z.strictObject({
    verified: z.boolean(),
    merchProducts: z.number().int().nonnegative().optional(),
    activeDrops: z.number().int().nonnegative().optional()
  })
});

export function safeCommunityDiscordFeed() {
  return {
    ok: true,
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
    sourceAvailable: false,
    updatedAt: null,
    live: { verified: false, isLive: false, title: null, url: null },
    info: Object.fromEntries(
      INFO_KEYS.map((key) => [key, { verified: false, text: null, url: null }])
    ),
    links: { verified: false, items: {} },
    socials: { verified: false, items: {} },
    announcement: { enabled: false, id: null, text: null, url: null },
    drops: [],
    stats: { verified: false }
  };
}

function safeMap(value) {
  const result = OfficialUrlMapSchema.safeParse(value || {});
  return result.success ? result.data : {};
}

function rowText(row, field, max = TEXT_LIMIT) {
  const result = cleanNullableTextSchema(max).safeParse(row?.[field] ?? null);
  return result.success ? result.data : null;
}

function rowUrl(row, field) {
  return normalizePublicUrl(row?.[field]);
}

export function communityInputFromRow(row) {
  return {
    live: {
      verified: Boolean(row?.live_verified),
      isLive: Boolean(row?.live_verified && row?.live_is_live),
      title: rowText(row, "live_title", 256),
      url: rowUrl(row, "live_url")
    },
    info: Object.fromEntries(
      INFO_KEYS.map((key) => [
        key,
        { text: rowText(row, `${key}_text`), url: rowUrl(row, `${key}_url`) }
      ])
    ),
    links: safeMap(row?.official_links),
    socials: safeMap(row?.official_socials),
    announcement: {
      enabled: Boolean(row?.announcement_enabled),
      text: rowText(row, "announcement_text", 2000),
      url: rowUrl(row, "announcement_url")
    }
  };
}

export function announcementNeedsNewId(input, currentRow = null) {
  const value = CommunityDiscordInputSchema.parse(input);
  if (!value.announcement.enabled) return false;
  return (
    !currentRow?.announcement_enabled ||
    rowText(currentRow, "announcement_text", 2000) !== value.announcement.text ||
    rowUrl(currentRow, "announcement_url") !== value.announcement.url
  );
}

export function communityInputToRow(input, { currentRow = null, announcementId = null, now } = {}) {
  const value = CommunityDiscordInputSchema.parse(input);
  const announcementChanged = announcementNeedsNewId(value, currentRow);
  const nextAnnouncementId = value.announcement.enabled
    ? announcementChanged
      ? announcementId
      : cleanText(currentRow?.announcement_id || "") || announcementId
    : "";

  if (value.announcement.enabled && !nextAnnouncementId) {
    throw new Error("Announcement ID generation failed.");
  }

  return {
    singleton: COMMUNITY_SINGLETON,
    live_verified: value.live.verified,
    live_is_live: value.live.verified && value.live.isLive,
    live_title: value.live.title || "",
    live_url: value.live.url,
    ...Object.fromEntries(
      INFO_KEYS.flatMap((key) => [
        [`${key}_text`, value.info[key].text || ""],
        [`${key}_url`, value.info[key].url]
      ])
    ),
    official_links: value.links,
    official_socials: value.socials,
    announcement_enabled: value.announcement.enabled,
    announcement_id: nextAnnouncementId,
    announcement_text: value.announcement.text || "",
    announcement_url: value.announcement.url,
    updated_at: now || new Date().toISOString()
  };
}

export function deriveCommunityDrops(products) {
  return (Array.isArray(products) ? products : [])
    .filter((product) => {
      const status = cleanText(product?.status ?? "").toLowerCase();
      return (
        product?.onlineStorePublished &&
        (!status || status === "active" || status === "live")
      );
    })
    .map((product) => {
      const url = normalizePublicUrl(product?.url);
      const image = normalizePublicUrl(product?.image);
      const id = cleanText(product?.id ?? "").slice(0, 256);
      const title = cleanText(product?.title ?? "").slice(0, 256);
      const numericPrice = Number(product?.price);
      const hasPrice =
        product?.price !== null &&
        product?.price !== undefined &&
        cleanText(product.price) !== "";
      if (!id || !title || !url) return null;
      return {
        id,
        title,
        url,
        price:
          hasPrice && Number.isFinite(numericPrice) && numericPrice >= 0
            ? numericPrice
            : null,
        image
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

export function buildCommunityDiscordFeed({
  row = null,
  products = [],
  storefrontAvailable = false
} = {}) {
  if (!row) return safeCommunityDiscordFeed();

  const editable = communityInputFromRow(row);
  const drops = storefrontAvailable ? deriveCommunityDrops(products) : [];
  const info = Object.fromEntries(
    INFO_KEYS.map((key) => [
      key,
      {
        verified: Boolean(editable.info[key].text || editable.info[key].url),
        ...editable.info[key]
      }
    ])
  );
  const announcementEnabled = Boolean(
    editable.announcement.enabled &&
      editable.announcement.text &&
      cleanText(row.announcement_id || "")
  );

  return CommunityDiscordFeedSchema.parse({
    ok: true,
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
    sourceAvailable: true,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    live: editable.live,
    info,
    links: {
      verified: Object.keys(editable.links).length > 0,
      items: editable.links
    },
    socials: {
      verified: Object.keys(editable.socials).length > 0,
      items: editable.socials
    },
    announcement: announcementEnabled
      ? {
          enabled: true,
          id: cleanText(row.announcement_id),
          text: editable.announcement.text,
          url: editable.announcement.url
        }
      : { enabled: false, id: null, text: null, url: null },
    drops,
    stats: storefrontAvailable
      ? {
          verified: true,
          merchProducts: Array.isArray(products) ? products.length : 0,
          activeDrops: drops.length
        }
      : { verified: false }
  });
}

