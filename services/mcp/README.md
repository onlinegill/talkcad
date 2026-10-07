# TalkCAD MCP server

This fork includes a dependency-free MCP stdio server that exposes local CAD/printing actions to MCP clients.

## Run

```bash
node services/mcp/server.mjs
```

Optional executable overrides:

```bash
OPENSCAD_PATH=/custom/path/openscad \
ORCASLICER_PATH=/custom/path/orca-slicer \
node services/mcp/server.mjs
```

## Tools

- `talkcad_validate_scad` — compile/validate OpenSCAD source.
- `talkcad_render_stl` — render OpenSCAD source to an STL file.
- `talkcad_slice` — render and slice through OrcaSlicer to printer-ready G-code.

## Example MCP client config

```json
{
  "mcpServers": {
    "talkcad": {
      "command": "node",
      "args": ["/absolute/path/to/talkcad/services/mcp/server.mjs"]
    }
  }
}
```

The server writes protocol messages only to stdout. Tool subprocess output is returned inside MCP tool results.
