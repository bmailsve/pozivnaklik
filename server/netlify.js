// Shared set-up for the Netlify Functions: one app per function instance, created on first request
// (the deploy context — production or staging — is only known once a request arrives).
import { loadConfig } from "./config.js";
import { createApp } from "./api.js";

let app = null;
export function appFor(context) {
  if (!app) app = createApp(loadConfig({ platform: "netlify", deployContext: context?.deploy?.context }));
  return app;
}
