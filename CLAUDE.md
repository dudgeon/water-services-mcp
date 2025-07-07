# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a **Model Context Protocol (MCP) server** deployed on **Cloudflare Workers** that provides real-time water level and flow data from the Potomac River via the USGS Water Services API. It uses **Durable Objects** for MCP agent state management and serves both utility tools and water data to AI clients like Claude Desktop.

## Development Commands

### Essential Commands
- `npm run dev` - Start local development server (runs on localhost:8787)
- `npm run deploy` - Deploy to Cloudflare Workers production
- `npm test` - Run test suite once
- `npm run test:watch` - Run tests in watch mode for development
- `npm run format` - Format code with Biome
- `npm run lint:fix` - Fix linting issues with Biome
- `npm run type-check` - Validate TypeScript without compilation

### Testing
- Tests use **Vitest** framework
- Located in `src/tests/` mirroring source structure
- Run single test file: `npx vitest src/tests/services/usgs-api.test.ts`
- Coverage report: `npm run test:coverage`

## Architecture

### Core Stack
- **Runtime**: Cloudflare Workers with Durable Objects
- **MCP Framework**: `@modelcontextprotocol/sdk` + `agents` library
- **Data Source**: USGS Water Services API
- **Validation**: Zod schemas for all inputs/outputs
- **Caching**: Cloudflare Cache API with intelligent TTL management

### Key Components

**MCP Agent (`src/index.ts`)**
- Extends `McpAgent` from agents library
- Handles SSE and direct MCP transport
- Routes: `/` (SSE), `/sse`, `/mcp`, `/messages`
- CORS configured for Claude Desktop compatibility

**Services Layer**
- `USGSApiService` - API client with timeout handling and error recovery
- `CacheService` - Time-bucketed caching with stale data fallback
- Concurrent data fetching for performance

**Tools**
- `add`, `calculate` - Basic utility tools
- `local_destinations` - Local attractions info
- `get_potomac_gage_depth` - Water level data (implementation complete but currently disabled)

### Caching Strategy
- **Current data**: 14-minute TTL
- **Historical data**: 30-minute TTL  
- Time window bucketing aligns cache keys within time periods
- Fallback to stale data during API outages
- Emergency response generation for total failures

## Claude Desktop Integration

### Connection Methods
1. **mcp-remote proxy** (all tiers): Use `npx mcp-remote https://water-services-mcp.dudgeon.workers.dev/sse`
2. **Direct connection** (Pro+ only): Add URL via Settings > Integrations

### Common Connection Issues
- **"Connection closed" errors**: Usually caused by incorrect binding parameters in `serveSSE()` calls
- **OAuth discovery requests**: Server handles `/.well-known/oauth-authorization-server` and `/register` endpoints
- **CORS headers**: Must include `mcp-session-id` and `mcp-protocol-version` headers

## USGS API Integration

### Data Sources
- **Georgetown Station** (01647600): Water level data
- **Little Falls Station** (01646500): Flow rate data
- **Parameters**: 00065 (gage height), 00060 (discharge)
- **Datum Support**: NAVD88 and WMLW conversions

### Data Processing
- 7-day min/max calculations for context
- Staleness detection (>30 minutes threshold)
- Robust error handling with multiple fallback strategies
- Comprehensive logging and metrics

## Key Configuration

### Wrangler Config (`wrangler.jsonc`)
- **Durable Objects**: `MyMCP` class bound as `MCP_OBJECT`
- **Compatibility**: nodejs_compat enabled, date 2025-03-10
- **Observability**: Enabled for monitoring

### Tool Development
- All tools defined in `src/index.ts` within `init()` method
- Use Zod schemas for input validation
- Return `ToolResult` format with content array
- Enable via `setToolRequestHandlers()` call

### Water Data Tools
All water data tools are fully implemented and enabled:
1. `get_potomac_conditions` - Primary tool for complete river conditions
2. `get_potomac_gage_depth` - Georgetown water level with trend analysis
3. `get_potomac_flow` - Little Falls flow rate with trend analysis
4. `get_measurement_info` - Technical documentation and methodology

## Deployment

Deployment is automatic via GitHub push to main branch. Manual deployment:
1. `npm run type-check` to validate
2. `npm test` to ensure tests pass  
3. `npm run deploy` to push to Cloudflare

Live URL: `https://water-services-mcp.dudgeon.workers.dev`

## Processing task lists

    ### Task List Management

    Guidelines for managing task lists in markdown files to track progress on completing a PRD

    #### Task Implementation
    - **One sub-task at a time:** Do **NOT** start the next sub‑task until you ask the user for permission and they say "yes" or "y"
    - **Completion protocol:**  
    1. When you finish a **sub‑task**, immediately mark it as completed by changing `[ ]` to `[x]`.
    2. **Document discoveries and findings** (see "Discovery Documentation" section below)
    3. If **all** subtasks underneath a parent task are now `[x]`, follow this sequence:
        - **First**: Run the full test suite (`pytest`, `npm test`, `bin/rails test`, etc.)
        - **Only if all tests pass**: Stage changes (`git add .`)
        - **Clean up**: Remove any temporary files and temporary code before committing
        - **Commit**: Use a descriptive commit message that:
        - Uses conventional commit format (`feat:`, `fix:`, `refactor:`, etc.)
        - Summarizes what was accomplished in the parent task
        - Lists key changes and additions
        - References the task number and PRD context
        - **Formats the message as a single-line command using `-m` flags**, e.g.:

            ```
            git commit -m "feat: add payment validation logic" -m "- Validates card type and expiry" -m "- Adds unit tests for edge cases" -m "Related to T123 in PRD"
            ```
    4. Once all the subtasks are marked completed and changes have been committed, mark the **parent task** as completed.
    - Stop after each sub‑task and wait for the user's go‑ahead.

    ## Discovery Documentation

    When completing each sub-task, **always add sub-bullets** to document:

    ##### Required Documentation Types:
    - **Discovery**: What you found that was unexpected or already implemented
    - **Finding**: Technical details, configurations, or implementation specifics discovered
    - **Challenge**: Problems, obstacles, or complications encountered
    - **Solution**: How challenges were resolved or worked around
    - **Result**: Outcomes, metrics, or measurable improvements achieved
    - **Change of Plan**: Any deviations from the original task approach

    ##### Format:
    ```markdown
    - [x] 2.5 Task description
    - **Discovery**: Implementation was already complete with proper configuration
    - **Finding**: Uses correct parameter codes and station targeting
    - **Challenge**: Initial tests were failing due to timeout issues
    - **Solution**: Simplified test approach to focus on error handling
    - **Result**: Test suite expanded from 11 to 14 tests, all passing
    ```

    ##### When to Document:
    - **Always** add at least one sub-bullet when marking a task complete
    - **Prioritize** discoveries that change understanding or approach
    - **Include** technical details that would help future developers
    - **Document** any deviation from the expected implementation path
    - **Note** performance improvements, test additions, or architectural decisions

    #### Task List Maintenance

    1. **Update the task list as you work:**
    - Mark tasks and subtasks as completed (`[x]`) per the protocol above.
    - Add discovery documentation as sub-bullets under completed tasks.
    - Add new tasks as they emerge.

    2. **Maintain the "Relevant Files" section:**
    - List every file created or modified.
    - Give each file a one‑line description of its purpose.

    #### AI Instructions

    When working with task lists, the AI must:

    1. Regularly update the task list file after finishing any significant work.
    2. Follow the completion protocol:
    - Mark each finished **sub‑task** `[x]`.
    - **Add discovery documentation as sub-bullets** before moving on.
    - Mark the **parent task** `[x]` once **all** its subtasks are `[x]`.
    3. Add newly discovered tasks.
    4. Keep "Relevant Files" accurate and up to date.
    5. Before starting work, check which sub‑task is next.
    6. After implementing a sub‑task, update the file with discoveries/findings and then pause for user approval.
    7. **Never skip discovery documentation** - even simple tasks should have at least one sub-bullet explaining what was found or accomplished.
