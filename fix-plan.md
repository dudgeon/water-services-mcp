# Plan: Replace Water Services MCP with Working Penguin Bank Implementation

## Objective
Replace the non-working water-services-mcp implementation with the proven working penguin-bank-mcp-flare code to establish a functional connection to Claude Desktop.

## Key Finding
The critical issue is **missing description parameters** in tool registrations. Working implementation uses:
```typescript
server.tool(name, description, schema, handler)
```
Current broken implementation uses:
```typescript
server.tool(name, schema, handler) // Missing description!
```

## Implementation Steps

### 1. Create Plan Documentation ✅
- Write this plan to a markdown file for future reference
- **STOP HERE** - await user confirmation before proceeding

### 2. Backup Current Implementation
- Create `backup/` directory in water-services-mcp
- Copy all current source files to backup for future reference
- Preserve git history with a commit

### 3. Copy Working Implementation
- Copy `src/index.ts` from penguin-bank-mcp-flare/my-mcp-server
- Copy `src/database.types.ts` if needed
- Update package.json dependencies to match working versions:
  - `@modelcontextprotocol/sdk`: `^1.12.3`
  - `agents`: `^0.0.95`

### 4. Adapt Configuration
- Keep existing `wrangler.jsonc` (already correct)
- Update server name/description in copied code
- Remove penguin-bank specific tools
- Add simple test tools to verify connectivity

### 5. Test and Deploy
- Run `npm install` to get correct dependency versions
- Test locally with `npm run dev`
- Deploy to Cloudflare Workers with `npm run deploy`
- Test Claude Desktop connection

### 6. Verify Connection
- Test connection using both mcp-remote proxy and direct URL
- Confirm tools are visible and functional in Claude Desktop

Once working, we can gradually port back water services tools using the correct API pattern.

## Analysis Summary

Based on comparison between the working penguin-bank-mcp-flare and broken water-services-mcp:

### Root Cause
**Missing description parameter** in tool registration calls is the primary issue causing connection failures.

### Secondary Issues
1. **Version Compatibility**: Water Services uses newer versions that may have different API requirements
2. **Complex Architecture**: More complex structure introduces additional failure points
3. **CORS Configuration**: Additional headers might cause client compatibility issues

### Working Implementation Characteristics
- Uses stable dependency versions (`@modelcontextprotocol/sdk`: `^1.12.3`, `agents`: `^0.0.95`)
- Follows exact expected API pattern for tool registration
- Simpler architecture with fewer failure points
- Proven to work with Claude Desktop connections

### Next Steps
After completing this plan and establishing a working connection, we can:
1. Gradually port water services tools using correct API pattern
2. Add back the sophisticated caching and error handling
3. Restore the comprehensive test suite
4. Maintain the working connection while enhancing functionality