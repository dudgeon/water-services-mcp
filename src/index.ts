import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPotomacGageDepth, GetPotomacGageDepthSchema, WaterLevelOutputSchema } from "./tools/potomac-gage-depth.js";

// Environment interface for proper typing
interface Env {
	MCP_OBJECT: DurableObjectNamespace;
}

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Water Services MCP",
		version: "1.0.0",
	});

	async init() {
		// Simple addition tool
		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			})
		);

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			}
		);

		// Local destinations tool
		this.server.tool(
			"local_destinations",
			{
				query: z.string().optional().describe("Optional query about specific destinations"),
			},
			async ({ query }) => {
				const destinations = [
					"🏔️ **Three Sisters** - A stunning mountain range perfect for hiking and scenic views",
					"🌲 Local hiking trails with beautiful forest walks",
					"🏞️ Scenic viewpoints and nature reserves",
					"🎣 Local fishing spots and water activities",
					"🏛️ Historical sites and cultural landmarks",
					"🍽️ Local restaurants and cafes with regional specialties"
				];

				let response = "Here are some wonderful local destinations to explore:\n\n";
				
				if (query && query.toLowerCase().includes("mountain")) {
					response += "🏔️ **Three Sisters** - This iconic mountain range is a must-visit destination! The Three Sisters offers:\n";
					response += "- Spectacular hiking trails for all skill levels\n";
					response += "- Breathtaking panoramic views\n";
					response += "- Photography opportunities\n";
					response += "- Wildlife viewing\n";
					response += "- Seasonal activities (skiing in winter, hiking in summer)\n\n";
				} else {
					response += destinations.join("\n") + "\n\n";
					response += "**Highlight: The Three Sisters** is particularly recommended for its spectacular mountain views and excellent hiking opportunities!\n\n";
				}

				response += "Would you like more specific information about any of these destinations?";

				return {
					content: [{ type: "text", text: response }],
				};
			}
		);

		// Potomac water level tool
		this.server.tool(
			"get_potomac_gage_depth",
			"Get current Potomac River depth at Georgetown. IMPORTANT: When presenting this data, explain the relationship between the current level and the 7-day range.",
			GetPotomacGageDepthSchema,
			async (params) => {
				return await getPotomacGageDepth(params);
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSse("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
