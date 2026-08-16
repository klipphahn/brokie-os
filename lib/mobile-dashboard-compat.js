export const MOBILE_DASHBOARD_DEPRECATION = "@1786838400";
export const MOBILE_DASHBOARD_SUCCESSOR_LINK =
  '</api/mobile/app>; rel="successor-version"';

export function deprecatedMobileDashboardHandler(handler) {
  return async function mobileDashboardCompatibilityHandler(...args) {
    const response = await handler(...args);
    response.headers.set("Deprecation", MOBILE_DASHBOARD_DEPRECATION);
    response.headers.append("Link", MOBILE_DASHBOARD_SUCCESSOR_LINK);
    return response;
  };
}
