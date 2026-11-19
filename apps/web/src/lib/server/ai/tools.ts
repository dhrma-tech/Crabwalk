// The only tools Crabby can call (BACKEND §11.3). All read our DB through the user's session (RLS);
// results carry slugs/names/facts only — never ids, phone numbers, coordinates or location history,
// and never Ola data. Actions are proposals (ai_actions) the user applies or discards.
// Hardening T3-05: each tool is its own file under tools/ ({ def, run }); this is the registry. The order of
// TOOL_DEFS is the order the model sees.
import { searchPlacesTool } from './tools/search_places.ts';
import { findPlacesTool } from './tools/find_places.ts';
import { getPlaceTool } from './tools/get_place.ts';
import { searchStaysTool, searchEateriesTool } from './tools/search_listings.ts';
import { getDishTool } from './tools/get_dish.ts';
import { nearbyTool } from './tools/nearby.ts';
import { getConditionsTool } from './tools/get_conditions.ts';
import { listMyTripsTool } from './tools/list_my_trips.ts';
import { buildPlanTool } from './tools/build_plan.ts';
import { editPlanTool } from './tools/edit_plan.ts';
import { proposeActionTool } from './tools/propose_action.ts';
import { driveTool } from './tools/drive.ts';
import { requestStayTool } from './tools/request_stay.ts';
import { askTeamTool } from './tools/ask_team.ts';
import { askUserTool } from './tools/ask_user.ts';
import { type Ctx, type Tool } from './tools/shared.ts';

export {
	proposeAskTeam,
	type ActionType,
	type Ctx,
	type Preview,
	type Proposed
} from './tools/shared.ts';

export const TOOLS: Tool[] = [
	searchPlacesTool,
	findPlacesTool,
	getPlaceTool,
	searchStaysTool,
	searchEateriesTool,
	getDishTool,
	nearbyTool,
	getConditionsTool,
	listMyTripsTool,
	buildPlanTool,
	editPlanTool,
	proposeActionTool,
	driveTool,
	requestStayTool,
	askTeamTool,
	askUserTool
];
export const TOOL_DEFS = TOOLS.map((t) => t.def);
const BY_NAME = new Map(TOOLS.map((t) => [t.def.name, t]));

export async function runTool(ctx: Ctx, name: string, rawArgs: string): Promise<unknown> {
	let a: Record<string, unknown>;
	try {
		a = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
	} catch {
		return { error: 'arguments were not valid JSON' };
	}
	const tool = BY_NAME.get(name);
	return tool ? tool.run(ctx, a) : { error: `unknown tool ${name}` };
}
