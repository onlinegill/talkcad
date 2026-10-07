# TalkCAD — SpeakCAD-class feature expansion

This fork extends TalkCAD toward a complete conversational CAD-to-print workflow while keeping the implementation original and open.

## Implemented

- OrcaSlicer executable auto-detection on macOS, Windows, and Linux
- Headless OrcaSlicer IPC bridge
- Current-model OpenSCAD → STL → OrcaSlicer → G-code flow
- OrcaSlicer printer/process/filament JSON profile loading
- Auto-orient, auto-arrange, and ensure-on-bed support
- Optional 3MF project export
- New Print & Slice UI panel
- OrcaSlicer bundled profile discovery and profile dropdowns
- Estimated print time and filament usage parsing from generated G-code
- Direct STL import into the 3D viewport
- Imported STL → OrcaSlicer slicing workflow
- Parametric Create panel with box, cylinder, rounded plate, tray, and mounting plate starters
- Dependency-free MCP stdio server with validate, STL render, and slice tools
- GitHub Actions validation for desktop TypeScript and MCP syntax

## Next milestones

1. 3MF import and full project round-trip
2. Multi-part/assembly project model
3. Direct manipulation tools for transforms, holes, cuts, arrays, dimensions
4. STEP/BREP backend via CadQuery/OpenCascade
5. Browser/web architecture
6. Mobile responsive editor
7. Rich MCP resources/prompts and project/session integration
8. Printer profile search/favorites and material presets
9. Cost estimates and spool tracking
10. Optional remote printer handoff

The goal is feature parity at the workflow level, not copying proprietary SpeakCAD code, branding, or assets.
