// Staff and owner strings (admin, verifier, owner pages) live in their own Paraglide project
// (`project.staff.inlang`, `messages/staff/*.json`), so they ship with those lazy route chunks and never
// with the public app shell (owner 2026-11-21: shell < 210 KB gz). Only staff/owner code imports this.
import { getLocale } from '#lib/paraglide/runtime.js';
import { overwriteGetLocale } from '#lib/paraglide-staff/runtime.js';

// One locale for both catalogues: the main runtime's (cookie → phone languages → English; per request on the server).
overwriteGetLocale(getLocale);

export { m as s } from '#lib/paraglide-staff/messages.js';
