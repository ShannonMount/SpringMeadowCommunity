import "server-only";

import { cache } from "react";
import { getCurrentPropertyMemberships } from "@/server/services/auth/property-memberships";

export const getResidentPortalMemberships = cache(async () => getCurrentPropertyMemberships());
