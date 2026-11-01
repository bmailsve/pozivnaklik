// Uploaded photos (/media/...) and link-preview pictures for WhatsApp, Viber and Instagram (/og/<code>.jpg).
import { appFor } from "../../server/netlify.js";

export default (req, context) => appFor(context).file(req);

export const config = { path: ["/media/*", "/og/*"] };
