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
- Parametric starter shapes: box, cylinder, rounded plate, tray, mounting plate
- Direct transforms: move, rotate, scale
- Direct cylindrical hole operation
- Linear array and mirror operations
- Persistent multi-part assembly capture/positioning
- MCP stdio server
- MCP primitive creation
- MCP OpenSCAD validation
- MCP STL rendering
- MCP OpenSCAD -> G-code
- MCP STL/3MF -> G-code
- CI typecheck + MCP syntax validation

## Missing for current SpeakCAD-class parity

### Direct hand tools
- Face selection/picking in the viewport
- Rectangular/circular/slot cuts on a selected face
- Add/tab tool
- Face extrusion
- Raised/engraved text
- Interactive round/fillet tool
- Measure tool
- Screw clearance presets M2-M8
- Countersink and counterbore
- Line/grid/circle/mirror duplication with editable parameters

### Mesh editing
- True boolean editing of imported STL/3MF geometry
- Editable ghost/previous-version overlay
- Direct STL/3MF -> parametric rebuild workflow
- Full 3MF viewport rendering and project round-trip

### Printing
- Searchable 380+ printer catalog UX
- Saved printer favorites / last-used settings
- High-level controls for layer height, speed, infill, walls, supports, adhesion
- Bambu .gcode.3mf output handling
- Spool tracking and print-cost estimates
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
- Project/session resources and prompts

### CAD backends
- STEP export
- CadQuery/OpenCascade backend
- BREP/native CAD interchange

### Marketplace/account features
- Accounts, private cloud projects, sharing/publishing, marketplace, credits/billing

The parity target is functional equivalence implemented independently. Proprietary SpeakCAD code, branding, private backend behavior, and billing logic are not copied.
