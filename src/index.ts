import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPotomacGageDepth, GetPotomacGageDepthSchema, WaterLevelOutputSchema } from "./tools/potomac-gage-depth.js";
import { getPotomacFlow, GetPotomacFlowSchema, FlowRateOutputSchema } from "./tools/potomac-flow.js";
import { getMeasurementInfo, GetMeasurementInfoSchema, MeasurementInfoOutputSchema } from "./tools/measurement-info.js";
import { getPotomacConditions, GetPotomacConditionsSchema, CombinedConditionsOutputSchema } from "./tools/potomac-conditions.js";


// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Potomac River Water Services",
		version: "1.0.0",
	});

	async init() {
		// Potomac water level tool
		this.server.tool(
			"get_potomac_gage_depth",
			{},
			async (params) => {
				return await getPotomacGageDepth(params);
			}
		);

		// Potomac flow rate tool
		this.server.tool(
			"get_potomac_flow",
			{},
			async (params) => {
				return await getPotomacFlow(params);
			}
		);

		// Measurement methodology documentation tool
		this.server.tool(
			"get_measurement_info",
			{
				topic: z.enum([
					"water_level_methodology",
					"flow_rate_methodology", 
					"stations",
					"units_datums",
					"quality_codes",
					"data_processing",
					"temporal_context",
					"api_technical",
					"overview"
				]).optional(),
				search_term: z.string().optional(),
				station_id: z.string().optional(),
				detail_level: z.enum(["overview", "detailed"]).optional()
			},
			async (params) => {
				return await getMeasurementInfo(params);
			}
		);

		// Combined conditions tool (water level + flow rate)
		this.server.tool(
			"get_potomac_conditions",
			{},
			async (params) => {
				return await getPotomacConditions(params);
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Handle CORS preflight requests
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 200,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		// Create a response wrapper to add CORS headers
		const addCorsHeaders = (response: Response) => {
			const newResponse = new Response(response.body, response);
			newResponse.headers.set("Access-Control-Allow-Origin", "*");
			newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
			return newResponse;
		};

		// Handle root path and /message for SSE connections
		if (url.pathname === "/" || url.pathname === "/message") {
			// Create a new request with /sse path for compatibility
			const sseUrl = new URL(request.url);
			sseUrl.pathname = url.pathname === "/" ? "/sse" : "/sse/message";
			const sseRequest = new Request(sseUrl, request);
			return MyMCP.serveSSE("/sse").fetch(sseRequest, env, ctx).then(addCorsHeaders);
		}

		// Keep /sse paths for backward compatibility
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx).then(addCorsHeaders);
		}

		// Handle /mcp path for direct MCP connections
		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx).then(addCorsHeaders);
		}

		return new Response("Not found", { status: 404 });
	},
};
