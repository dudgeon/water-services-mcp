# Potomac River Water Services MCP Server

A Model Context Protocol (MCP) server deployed on Cloudflare Workers that provides real-time Potomac River water level and flow data from USGS monitoring stations. This server uses the USGS Water Services API to deliver current conditions, historical context, and trend analysis through AI-friendly tools.

## Available Tools

The server provides the following tools:

### Water Data Tools
- `get_potomac_conditions` - **Primary tool** providing complete current conditions including water level and flow rate with historical context
- `get_potomac_gage_depth` - Georgetown water level data with 7-day range and 90-minute trend analysis
- `get_potomac_flow` - Little Falls flow rate data with 7-day range and 90-minute trend analysis
- `get_measurement_info` - Technical documentation about measurement methodologies, units, and data quality

### Utility Tools
- `add` - Simple addition of two numbers
- `calculate` - Multi-operation calculator (add, subtract, multiply, divide)
- `local_destinations` - Information about local attractions and destinations

## USGS Data Sources

This server collects real-time data from two USGS monitoring stations:

- **Georgetown Station (01647600)** - Water level monitoring at Wisconsin Ave
  - Provides water level in feet (NAVD88 and WMLW datums)
  - Located 0.6 miles upstream from Rock Creek mouth
  - Coordinates: 38.9033611°, -77.0676667°

- **Little Falls Station (01646500)** - Flow rate monitoring near pump station
  - Provides discharge in cubic feet per second (CFS)
  - Located in Montgomery County, Maryland
  - Coordinates: 38.94977778°, -77.12763889°

All data includes:
- Current readings with timestamps
- 7-day historical min/max values
- 90-minute trend analysis (rising/falling/stable)
- Data staleness indicators (>30 minutes old)

## Server Endpoints

This server uses a **proven routing pattern** that works reliably with Claude Desktop:

- **`/` (root)** - Redirects to SSE endpoint for client compatibility
- **`/message`** - Redirects to SSE message endpoint
- **`/sse`** - **Primary SSE endpoint** (use this for Claude Desktop connections)
- **`/sse/message`** - SSE message handling endpoint
- **`/mcp`** - Direct MCP protocol endpoint (alternative transport)

**Live URLs:**
- **SSE Stream**: `https://water-services-mcp.dudgeon.workers.dev/sse`
- **Direct MCP**: `https://water-services-mcp.dudgeon.workers.dev/mcp`
- **Base URL**: `https://water-services-mcp.dudgeon.workers.dev/` (redirects to SSE)

## Connect Claude Desktop to your MCP server

### Method 1: Using mcp-remote proxy (Works with all Claude Desktop tiers)

For Claude Desktop (all tiers including free), use the [mcp-remote proxy](https://www.npmjs.com/package/mcp-remote) to connect:

1. Open Claude Desktop and go to **Settings > Developer > Edit Config**
2. Add the following configuration:

```json
{
  "mcpServers": {
    "water-services": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://water-services-mcp.dudgeon.workers.dev/sse"
      ]
    }
  }
}
```

3. Restart Claude Desktop
4. The Water Services tools should now be available in your conversation

### Method 2: Direct Connection (Pro/Teams/Enterprise only)

If you have Claude Desktop Pro, Teams, or Enterprise:

1. Go to **Settings > Integrations** in Claude Desktop
2. Add the server URL: `https://water-services-mcp.dudgeon.workers.dev/`
3. The connection will be established automatically

## Troubleshooting

### Connection Issues

If you see "There was an error connecting to Water Services server":

1. **Verify you're using the correct method** - Free tier must use mcp-remote proxy
2. **Check the URL** - Ensure you're using the `/sse` endpoint for mcp-remote
3. **Restart Claude Desktop** after configuration changes
4. **Check logs** - Run Claude Desktop from terminal to see detailed error messages

### Common Errors

- **"Server transport closed unexpectedly"** - This usually means the proxy isn't running. Make sure `npx mcp-remote` executes successfully
- **"Authentication error"** - This server doesn't require auth. If you see this, check your configuration
- **CORS errors** - The server is configured to accept all origins. This shouldn't occur

## Development

To run locally:

```bash
npm install
npm run dev
```

The server will be available at `http://localhost:8787`

To deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Features

- **Real-time Data**: Current water conditions updated every few minutes from USGS
- **Historical Context**: 7-day min/max ranges for perspective
- **Trend Analysis**: 90-minute trend detection to identify rising/falling conditions
- **Smart Caching**: Intelligent caching with appropriate TTLs (14min current, 30min historical)
- **Fallback Strategies**: Stale data and emergency responses during API outages
- **Professional Landing Page**: Interactive map and tool documentation at the base URL

## Technical Details

- **Runtime**: Cloudflare Workers with Durable Objects
- **Protocol**: Model Context Protocol (MCP) v1.13.1
- **Transport**: Server-Sent Events (SSE) and direct MCP
- **Authentication**: None required (authless)
- **CORS**: Minimal configuration for maximum compatibility
- **Data Source**: USGS Water Services API
- **Caching**: Cloudflare Cache API with time-bucketed keys
- **Validation**: Zod schemas for all inputs/outputs

## Critical Configuration (DO NOT MODIFY)

This server configuration has been **proven to work** with Claude Desktop. The following settings are critical for maintaining connectivity:

### CORS Headers (Minimal & Working)
```javascript
"Access-Control-Allow-Origin": "*"
"Access-Control-Allow-Methods": "GET, POST, OPTIONS"
"Access-Control-Allow-Headers": "Content-Type, Authorization"
```

**⚠️ IMPORTANT:** Do NOT add MCP-specific headers like `mcp-session-id` or `mcp-protocol-version` to CORS configuration. These cause Claude Desktop connection failures.

### Routing Pattern (Proven & Stable)
The exact routing implementation matches the working penguin-bank-mcp pattern:

1. **Root paths** (`/`, `/message`) redirect to SSE endpoints
2. **SSE endpoints** (`/sse`, `/sse/message`) handle Server-Sent Events
3. **MCP endpoint** (`/mcp`) provides direct MCP protocol access
4. **Simple logic** without complex POST request handling

### Connection Sequence
Claude Desktop expects this specific handshake:
1. Client connects to `/sse` endpoint
2. Server responds with proper CORS headers (minimal set only)
3. SSE connection established using `McpAgent.serveSSE()`
4. MCP protocol negotiation occurs over SSE transport

**⚠️ WARNING:** Any modifications to CORS headers or routing logic may break Claude Desktop connectivity. This configuration has been tested and verified to work.