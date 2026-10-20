import { error } from '@sveltejs/kit';

/** Request body as FormData; a missing or non-form body is a 400, not an unhandled 500. */
export const formBody = (request: Request) =>
	request.formData().catch(() => error(400, 'expected a form body'));
