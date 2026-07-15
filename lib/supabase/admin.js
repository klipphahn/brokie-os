import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdminCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

function createNoopQuery() {
  const query = {
    then(resolve) {
      return Promise.resolve(resolve({ data: null, error: null, count: 0 }));
    },
    catch() {
      return Promise.resolve({ data: null, error: null, count: 0 });
    },
    finally(callback) {
      try {
        callback?.();
      } catch {
        // ignore
      }
      return Promise.resolve({ data: null, error: null, count: 0 });
    }
  };

  let proxy = null;

  proxy = new Proxy(query, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (..._args) => proxy;
    }
  });

  return proxy;
}

function createNoopSupabaseClient() {
  const query = createNoopQuery();

  return {
    from() {
      return query;
    },
    auth: {
      async getUser() {
        return { data: { user: null }, error: null };
      },
      async signOut() {
        return { error: null };
      },
      async signInWithPassword() {
        return { data: null, error: null };
      }
    },
    storage: {
      from() {
        return {
          async upload() {
            return { data: null, error: null };
          },
          getPublicUrl(path) {
            return {
              data: {
                publicUrl: path || null
              }
            };
          }
        };
      }
    }
  };
}

export function createSupabaseAdminClient() {
  const credentials = getSupabaseAdminCredentials();

  if (!credentials) {
    return createNoopSupabaseClient();
  }

  return createClient(credentials.url, credentials.key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export function tryCreateSupabaseAdminClient() {
  return createSupabaseAdminClient();
}
