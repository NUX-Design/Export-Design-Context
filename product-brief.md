# Export tokens to selected

Plugin identity:
- displayName: Export tokens to selected
- description: Inspect selected layers and descendants; export token bindings, raw foundation values, styles and variable dependencies as Markdown and JSON.

Original user prompt:
สร้าง plugin ที่ชื่อ export tokens to selected ให้หน่อยโดยต้องมีรายละเอียดและสิ่งที่ทำได้ดังนี้

เมื่อเลือกที่ frame, layer ไหนที่ส่วนนั้นมีการ apply design tokens foundation ทุกอย่างไว้ให้แสดงเป็น report md ออกมาแล้วส่วนไหนที่ไม่ได้มีการ apply tokens ไว้ให้แสดงเป็น raw value ไว้แล้วให้ export ออกมาเป็น json ที่ระบุค่าที่ใช้ทั้งหมดไว้เพื่อนำไปใช้ให้ ai agents หรือนำไปแปลงทำเป็นระบบ design system ในงาน coding ได้ด้วยเลย

Usage:
Select one or more layers, then scan selection including descendants. Read-only audit, hidden layers included. Preview Markdown and download .md or .json independently. JSON includes property-level provenance, actual values, variable IDs/keys/names, collections, modes, aliases and dependencies, styles, typography ranges, and raw values. No guessed token matches. Explicit warnings for unresolved metadata and scan limits. Export is an extraction snapshot, not an automatic production code conversion or a claim of DTCG conformance.

AI design-context output:
The Markdown export is an implementation brief for coding agents. Lead with source/coverage, selected node geometry, a visual reference link, a node hierarchy/layout summary, component and variant metadata, captured prototype reactions, and text ranges; retain the detailed token, style, and property tables after the brief. For a single selected root, export a companion PNG beside the Markdown. Make missing visuals or metadata explicit and tell agents not to invent behavior or responsive rules that were not captured. Preserve JSON as the structured extraction snapshot.

Readability and selection reliability update:
- English explanatory copy is 14px with 1.65 line height; Markdown preview is 13px, heading 16px.
- Initialize selection from a safely escaped snapshot, install the message receiver before opening the panel, and retry the ready handshake a bounded number of times.
- Display selection names/count, explicit connection status, and a manual refresh-selection action. Scan always reads the current canvas selection.

English and fit-to-content update:
- All plugin UI labels, descriptions, empty states, scan progress, errors and export actions are English. Exported source content and token names remain unchanged.
- Keep a 320px panel width and cap height to the available screen space (up to 720px). Only the content area scrolls; keep the header and footer visible. Place native Markdown/JSON/PNG export buttons in the sticky footer after a successful scan, and allow the Markdown preview up to 380px before its own scroll area is needed.
- Group selection into a bounded card, align export actions in equal columns, and bound the report preview and warnings to avoid oversized windows.
