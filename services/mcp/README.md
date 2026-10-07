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

- `talkcad_export_step` — export a constrained CadQuery/OpenCascade model to native STEP (requires CadQuery in Python).
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

## CadQuery / STEP

Native STEP export is optional. Install CadQuery in a Python environment visible to TalkCAD/MCP, for example:

```bash
python3 -m pip install cadquery
```

Set `CADQUERY_PYTHON` for the MCP server if CadQuery is installed in a specific Python environment.

## HTTP transport

Run the browser backend with `pnpm web`. It exposes a stateless MCP endpoint at:

```
http://127.0.0.1:8787/mcp
```

Set `TALKCAD_MCP_TOKEN` before launching to require `Authorization: Bearer <token>` on MCP HTTP requests. The stdio server remains available through `pnpm mcp`.
