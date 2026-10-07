# TalkCAD — SpeakCAD-class feature expansion

This fork extends TalkCAD toward a complete conversational CAD-to-print workflow while keeping the implementation original and open.

## Implemented in the first foundation pass

- OrcaSlicer executable auto-detection on macOS, Windows, and Linux
- Headless OrcaSlicer IPC bridge
- Current-model OpenSCAD → STL → OrcaSlicer → G-code flow
- OrcaSlicer printer/process/filament JSON profile loading
- Auto-orient, auto-arrange, and ensure-on-bed support
- Optional 3MF project export
- New Print & Slice UI panel

## Next milestones

1. Printer/profile browser and bundled profile discovery
2. Print-time, filament, and cost estimates
3. STL and 3MF import workflows
4. Multi-part/assembly project model
5. Direct manipulation tools for transforms, holes, cuts, arrays, dimensions
6. STEP/BREP backend via CadQuery/OpenCascade
7. Browser/web architecture
8. MCP server for model creation/export/slicing
9. Mobile responsive editor
10. Optional remote printer handoff

The goal is feature parity at the workflow level, not copying proprietary SpeakCAD code, branding, or assets.
