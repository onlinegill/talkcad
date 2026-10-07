# TalkCAD — SpeakCAD parity audit

This fork now covers the core local conversational CAD-to-print workflow, but it is not yet full feature parity with the current SpeakCAD product.

## Implemented

- OpenSCAD conversational CAD workflow
- Local/cloud LLM support inherited from TalkCAD
- STL rendering and viewport preview
- STL import
- 3MF import for slicing
- OrcaSlicer executable discovery on macOS, Windows, and Linux
- OrcaSlicer profile discovery
- Printer/process/filament profile selection
- Auto-orient, auto-arrange, ensure-on-bed
- G-code generation
- Optional Orca 3MF export
- Print-time and filament estimates
- Searchable installed printer profile list
- Layer height, infill density/pattern, wall loops, support type, and speed overrides
- Bambu-style .gcode.3mf export option
- Material cost estimate
- Parametric starter shapes: box, cylinder, rounded plate, tray, mounting plate
- Direct transforms: move, rotate, scale
- Direct cylindrical hole operation
- M2-M8 screw clearance presets
- Countersink and counterbore tools
- Rectangular and slot cuts
- Add-tab/boss tool
- Raised and engraved text
- Whole-part rounding operation
- Linear, grid, circular, and mirror duplication
- Measurement readout from rendered model stats
- Persistent multi-part assembly capture/positioning
- MCP stdio server
- MCP primitive creation
- MCP OpenSCAD validation
- MCP STL rendering
- MCP OpenSCAD -> G-code
- MCP STL/3MF -> G-code
- MCP resources for capabilities and workflow
- MCP reusable design/print prompts
- CI typecheck + MCP syntax validation + desktop build

## Missing for current SpeakCAD-class parity

### Direct hand tools
- Face selection/picking in the viewport
- True face-topology selection/extrusion (viewport click-to-target placement is implemented)
- Face extrusion
- Interactive face-level fillet/chamfer tool
- Viewport click-to-measure
- Viewport handles for line/grid/circle/mirror duplication

### Mesh editing
- True boolean editing of imported STL/3MF geometry
- Editable ghost/previous-version overlay
- Direct STL/3MF -> parametric rebuild workflow
- Full 3MF project round-trip editing (viewport preview is implemented)

### Printing
- Remote/cloud-synced printer favorites (local favorites/last-used settings are implemented)
- Multi-spool inventory history (single-spool tracking is implemented)
- Remote printer handoff

### Web/mobile
- Browser-hosted editor
- Fully responsive phone/tablet UI
- Touch face-picking and tool placement
- Cloud project sync/accounts

### MCP
- Streamable HTTP transport
- OAuth 2.1 account auth
- MCP Apps / interactive 3D view
- Project/session file resources (capability/workflow resources and prompts are implemented)

### CAD backends
- STEP export
- CadQuery/OpenCascade backend
- BREP/native CAD interchange

### Marketplace/account features
- Accounts, private cloud projects, sharing/publishing, marketplace, credits/billing

The parity target is functional equivalence implemented independently. Proprietary SpeakCAD code, branding, private backend behavior, and billing logic are not copied.
