// zod in the browser (drive steps, question cards): no JIT. Its `new Function` probe is reported as a CSP
// `script-src` violation even though zod catches it (our CSP has no 'unsafe-eval').
import { z } from 'zod';

z.config({ jitless: true });
