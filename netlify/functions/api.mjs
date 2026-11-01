// The JSON API (/api/*). Data lives in Postgres (DATABASE_URL), photos in Netlify Blobs.
import { appFor } from "../../server/netlify.js";

export default (req, context) => appFor(context).handle(req, context.ip || "");

export const config = { path: ["/api", "/api/*"] };
