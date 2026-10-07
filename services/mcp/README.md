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

- `talkcad_create_primitive` — create OpenSCAD source for a box, cylinder, or sphere.
- `talkcad_validate_scad` — compile/validate OpenSCAD source.
- `talkcad_render_stl` — render OpenSCAD source to an STL file.
- `talkcad_slice` — render and slice OpenSCAD through OrcaSlicer to printer-ready G-code.
- `talkcad_slice_file` — slice an existing STL or 3MF file with OrcaSlicer.

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

## Resources

- `talkcad://capabilities` — current CAD, export, slicing, executable, and tool capabilities.
- `talkcad://workflow` — recommended design-to-print MCP workflow.

## Prompts

- `design_part` — reusable prompt for generating manufacturable parametric OpenSCAD.
- `prepare_print` — reusable prompt for planning a printer/profile-aware slicing workflow.
