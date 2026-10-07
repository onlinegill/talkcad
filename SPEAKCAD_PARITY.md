# TalkCAD — SpeakCAD parity audit

This fork now covers the core local conversational CAD-to-print workflow, but it is not yet full feature parity with the current SpeakCAD product.

## Implemented

- OpenSCAD conversational CAD workflow
- Local/cloud LLM support inherited from TalkCAD
- STL rendering and viewport preview
- STL import
- 3MF import for slicing and viewport preview
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
- Local printer favorites and last-used print settings
- Multi-spool local filament inventory with remaining-weight tracking and per-spool cost
- Brim, raft, and skirt quick controls
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
- Viewport click-to-target with face index and surface normal
- Two-point viewport distance measurement
- Previous-checkpoint ghost overlay for visual comparison
- OpenSCAD boolean/transform operations on imported STL/3MF source files
- Persistent multi-part assembly capture/positioning
- Responsive core layout for tablet/mobile breakpoints
- Browser-hosted local editor using the same React renderer
- Local browser backend for OpenSCAD, OrcaSlicer, CadQuery, LLM proxying and printer handoff
- Stateless MCP HTTP endpoint with optional bearer-token protection
- MCP stdio server
- MCP primitive creation
- MCP OpenSCAD validation
- MCP STL rendering
- MCP OpenSCAD -> G-code
- MCP STL/3MF -> G-code
- MCP resources for capabilities and workflow
- MCP reusable design/print prompts
- Native STEP export through optional constrained CadQuery/OpenCascade backend
- Desktop STEP panel with box/cylinder/sphere, hole, fillet/chamfer and STL preview
- MCP `talkcad_export_step` tool
- CI typecheck + MCP syntax validation + desktop build

## Missing for current SpeakCAD-class parity

### Direct hand tools
- True editable face-topology selection/extrusion (face index/normal picking is implemented)
- Face extrusion
- Interactive face-level fillet/chamfer tool
- Viewport drag handles for transforms and duplication

### Mesh editing
- Direct mesh-topology editing beyond OpenSCAD import-based booleans

- Direct STL/3MF -> parametric rebuild workflow
- Full 3MF project round-trip editing (preview and slicing are implemented)

### Printing
- Remote/cloud-synced printer favorites
- Cloud-synced spool inventory/history
- Remote/cloud printer management beyond direct OctoPrint/Moonraker upload/print handoff

### Web/mobile
- Full browser/mobile shell beyond the responsive core layout
- Touch-optimized drag handles and tool placement
- Cloud project sync/accounts

### MCP
- Full modern 2026 MCP transport semantics beyond the current stateless HTTP bridge
- OAuth 2.1 account auth
- MCP Apps / interactive 3D view
- Project/session file resources (capability/workflow resources and prompts are implemented)

### CAD backends
- Full free-form CadQuery/OpenCascade model authoring beyond the constrained native-CAD builder
- Broader BREP/native CAD interchange beyond STEP export

### Marketplace/account features
- Accounts, private cloud projects, sharing/publishing, marketplace, credits/billing

The parity target is functional equivalence implemented independently. Proprietary SpeakCAD code, branding, private backend behavior, and billing logic are not copied.
