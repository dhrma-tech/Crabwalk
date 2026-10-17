import { handle, type Env } from './handler.ts';

export default { fetch: (req: Request, env: Env) => handle(req, env) };
