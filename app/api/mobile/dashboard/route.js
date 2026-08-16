import {
  GET as mobileAppGet,
  POST as mobileAppPost
} from "@/app/api/mobile/app/route";
import { deprecatedMobileDashboardHandler } from "@/lib/mobile-dashboard-compat";

export const GET = deprecatedMobileDashboardHandler(mobileAppGet);
export const POST = deprecatedMobileDashboardHandler(mobileAppPost);
