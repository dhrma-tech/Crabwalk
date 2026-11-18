// Optimistic rating state shared by VerdictVote and VerdictGauge on one detail page (hardening T1-05).
// Written only in the browser (mount and event handlers), never during server rendering.
export const live = $state({
	/** The listing these values belong to. */
	id: '',
	/** The traveller group the person votes as. */
	group: null as string | null,
	/** Own verdicts per group, ahead of the server. */
	verdicts: {} as Partial<Record<string, number>>,
	/** A counted vote not yet in the server's aggregate. */
	pending: null as null | { group: string; prev?: number; level: number }
});
