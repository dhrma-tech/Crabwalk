import { z } from 'zod';
import { LICENCES, type Licence } from '#lib/photoCredit.ts';

/** Photo credit from a form (T-51): author + licence + https source, all or none (empty = our own photo). */
export const creditInput = z
	.object({
		credit: z.string().trim().max(200).default(''),
		licence: z.union([z.enum(LICENCES), z.literal('')]).default(''),
		source_url: z.union([z.url({ protocol: /^https$/ }).max(500), z.literal('')]).default('')
	})
	.refine(
		(c) => (c.credit === '') === (c.licence === '') && (c.credit === '') === (c.source_url === ''),
		{ message: 'give author, licence and source together, or none for our own photo' }
	)
	.transform((c) =>
		c.credit
			? { credit: c.credit, licence: c.licence as Licence, source_url: c.source_url }
			: { credit: null, licence: null, source_url: null }
	);
