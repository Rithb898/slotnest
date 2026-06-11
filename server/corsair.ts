import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { createCorsair } from "corsair";
import { env } from "@/lib/config/env";
import { conn } from "./db";

export const corsair = createCorsair({
  plugins: [
    gmail({ authType: "oauth_2" }),
    googlecalendar({ authType: "oauth_2" }),
  ],
  database: conn,
  kek: env.CORSAIR_KEK,
  multiTenancy: true,
});
