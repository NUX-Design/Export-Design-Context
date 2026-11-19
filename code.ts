const TOOL_ID = '0f7ad9a5-f7d0-4fc1-85bd-e7ab82d31dc2'
const DISPLAY_NAME = 'Export tokens to selected'
const MAX_LAYERS = 20000
const PLUGIN_WIDTH = 320
const MAX_PLUGIN_HEIGHT = 720
const MAX_VARIABLES = 10000
const MAX_PREVIEW_BYTES = 8 * 1024 * 1024
type Dict = Record<string, unknown>
type Ref = { path: string; variableId: string }
type Entry = { property: string; value: unknown; source: string; bindings: Ref[]; styleId: string | null; resolutions: unknown[] }
type Layer = { id: string; name: string; type: string; parentId: string | null; path: string[]; visible: boolean; bounds: unknown; component: unknown; reactions: unknown; resolvedModes: unknown; explicitModes: unknown; entries: Entry[]; textRanges: unknown[] }
type Msg = { type: string; descendants?: boolean; height?: number }
const FIELDS = [
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'rotation',
  'opacity', 'blendMode', 'visible', 'fills', 'strokes', 'effects', 'layoutGrids',
  'strokeWeight', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight',
  'strokeAlign', 'strokeCap', 'strokeJoin', 'strokeMiterLimit', 'dashPattern',
  'cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius', 'cornerSmoothing',
  'layoutMode', 'layoutWrap', 'itemSpacing', 'counterAxisSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'primaryAxisAlignItems', 'counterAxisAlignItems', 'counterAxisAlignContent', 'primaryAxisSizingMode', 'counterAxisSizingMode',
  'layoutSizingHorizontal', 'layoutSizingVertical', 'layoutAlign', 'layoutGrow', 'layoutPositioning',
  'itemReverseZIndex', 'strokesIncludedInLayout', 'clipsContent', 'constraints',
  'gridRowGap', 'gridColumnGap', 'gridRowCount', 'gridColumnCount', 'gridRowSizes', 'gridColumnSizes',
  'gridRowSpan', 'gridColumnSpan', 'gridChildHorizontalAlign', 'gridChildVerticalAlign',
  'fontName', 'fontSize', 'fontWeight', 'textCase', 'textDecoration', 'lineHeight', 'letterSpacing',
  'paragraphSpacing', 'paragraphIndent', 'listSpacing', 'textAlignHorizontal', 'textAlignVertical',
  'textAutoResize', 'textTruncation', 'maxLines', 'leadingTrim', 'hangingPunctuation', 'hangingList',
  'componentProperties', 'characters', 'textWrapStyle', 'openTypeFeatures', 'listOptions', 'indentation'
]
const STYLE_FIELDS: Record<string, string> = { fills: 'fillStyleId', strokes: 'strokeStyleId', effects: 'effectStyleId', layoutGrids: 'gridStyleId' }
const TEXT_STYLE_FIELDS = ['fontName', 'fontSize', 'fontWeight', 'textCase', 'textDecoration', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'paragraphIndent', 'listSpacing', 'leadingTrim', 'hangingPunctuation', 'hangingList', 'textWrapStyle']
let busy = false
let serial = 0

function record(value: unknown): Dict {
  return value !== null && typeof value === 'object' ? value as Dict : {}
}
function snapshot(value: unknown): unknown {
  if (value === figma.mixed) return { kind: 'mixed', note: 'See text ranges for individual values' }
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) => typeof item === 'symbol' ? { kind: 'mixed' } : item)) as unknown
}
function aliases(value: unknown, prefix = ''): Ref[] {
  const out: Ref[] = []
  const stack: { value: unknown; path: string; depth: number }[] = [{ value, path: prefix, depth: 0 }]
  for (let i = 0; stack.length && i < 100000; i++) {
    const next = stack.pop()!
    if (next.depth > 40 || !next.value || typeof next.value !== 'object') continue
    const obj = record(next.value)
    if (obj.type === 'VARIABLE_ALIAS' && typeof obj.id === 'string') {
      out.push({ path: next.path, variableId: obj.id })
    } else {
      for (const key of Object.keys(obj)) stack.push({ value: obj[key], path: next.path ? next.path + '.' + key : key, depth: next.depth + 1 })
    }
  }
  return out
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error) }
function cell(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/`/g, '&#96;').replace(/\r?\n/g, '<br>')
}
function valueOf(layer: Layer, property: string): unknown {
  return layer.entries.find(entry => entry.property === property)?.value
}
function dimensions(layer: Layer): string {
  const bounds = record(layer.bounds)
  const box = record(bounds.absoluteBoundingBox)
  const width = box.width ?? valueOf(layer, 'width')
  const height = box.height ?? valueOf(layer, 'height')
  const x = box.x ?? bounds.x
  const y = box.y ?? bounds.y
  return [x, y, width, height].every(value => typeof value === 'number')
    ? `${Math.round(x as number)}, ${Math.round(y as number)} · ${Math.round(width as number)} × ${Math.round(height as number)} px`
    : 'Dimensions unavailable'
}
function componentSummary(value: unknown): Dict {
  const component = record(value)
  const main = record(component.mainComponent)
  return {
    mainComponent: main.id ? { id: main.id, name: main.name, key: main.key, remote: main.remote } : null,
    properties: component.properties ?? null,
    variantProperties: component.variantProperties ?? null,
    variantGroupProperties: component.variantGroupProperties ?? null,
    propertyDefinitions: component.propertyDefinitions ?? null
  }
}
function layoutSummary(layer: Layer): string {
  const get = (key: string): unknown => valueOf(layer, key)
  const parts: string[] = []
  const mode = get('layoutMode')
  if (mode && mode !== 'NONE') parts.push(`auto layout ${mode}`)
  const direction = get('layoutWrap')
  if (direction && direction !== 'NO_WRAP') parts.push(`wrap ${direction}`)
  for (const [key, label] of [['itemSpacing', 'gap'], ['counterAxisSpacing', 'counter gap'], ['paddingTop', 'top'], ['paddingRight', 'right'], ['paddingBottom', 'bottom'], ['paddingLeft', 'left']] as const) {
    const value = get(key)
    if (typeof value === 'number' && value !== 0) parts.push(`${label} ${value}px`)
  }
  const primary = get('primaryAxisAlignItems')
  const counter = get('counterAxisAlignItems')
  if (primary) parts.push(`main align ${primary}`)
  if (counter) parts.push(`cross align ${counter}`)
  const sizing = [get('layoutSizingHorizontal'), get('layoutSizingVertical')].filter(Boolean)
  if (sizing.length) parts.push(`sizing ${sizing.join(' / ')}`)
  const positioning = get('layoutPositioning')
  if (positioning) parts.push(`position ${positioning}`)
  return parts.length ? parts.join('; ') : 'No auto layout detected; see captured properties for size and positioning'
}
function markdownCell(value: unknown): string { return cell(value ?? '—') }
function selectionPayload(): { type: string; count: number; names: string[]; busy: boolean } {
  const selected = figma.currentPage.selection
  return { type: 'selection', count: selected.length, names: selected.map(n => n.name), busy }
}
function selectionState(): void { figma.ui.postMessage(selectionPayload()) }

async function scan(descendants: boolean): Promise<void> {
  if (busy) return
  const selected = [...figma.currentPage.selection]
  if (!selected.length) { figma.notify('Select at least one layer'); selectionState(); return }
  busy = true
  serial++
  const runId = serial
  figma.ui.postMessage({ type: 'start' })
  try {
    const warnings = new Set<string>()
    const variables: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    const collections: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    const styles: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    const cache = new Map<string, Variable | null>()
    const queue: string[] = []
    const queued = new Set<string>()
    const layers: Layer[] = []
    const seen = new Set<string>()
    let truncated = false
    function enqueue(id: string): void {
      if (queued.has(id)) return
      if (queued.size >= MAX_VARIABLES) { warnings.add('Variable dependency limit reached (10000); dependency inventory is incomplete.'); truncated = true; return }
      queued.add(id); queue.push(id)
    }
    async function variable(id: string): Promise<Variable | null> {
      if (cache.has(id)) return cache.get(id) ?? null
      try {
        const v = await figma.variables.getVariableByIdAsync(id)
        cache.set(id, v)
        if (!v) warnings.add('Variable unavailable: ' + id)
        return v
      } catch (error) {
        warnings.add('Variable metadata unavailable: ' + id + ': ' + message(error)); cache.set(id, null); return null
      }
    }
    async function style(id: string): Promise<void> {
      if (Object.prototype.hasOwnProperty.call(styles, id)) return
      styles[id] = { id, unavailable: true }
      try {
        const s = await figma.getStyleByIdAsync(id)
        if (!s) { warnings.add('Style unavailable: ' + id); return }
        const data: Dict = { id: s.id, name: s.name, key: s.key, remote: s.remote, type: s.type, description: s.description }
        const obj = s as unknown as Dict
        const fields = s.type === 'PAINT' ? ['paints', 'boundVariables'] : s.type === 'EFFECT' ? ['effects', 'boundVariables'] : s.type === 'GRID' ? ['layoutGrids', 'boundVariables'] : [...TEXT_STYLE_FIELDS, 'boundVariables']
        for (const key of fields) if (key in s) data[key] = snapshot(obj[key])
        styles[id] = data
        for (const ref of aliases(data)) enqueue(ref.variableId)
      } catch (error) { warnings.add('Style metadata unavailable: ' + id + ': ' + message(error)) }
    }
    async function entries(obj: Dict, bound: Dict, consumer: SceneNode, prefix: string): Promise<Entry[]> {
      const result: Entry[] = []
      const fields = Array.from(new Set([...FIELDS.filter(key => key in obj), ...Object.keys(bound)]))
      for (const key of fields) {
        const raw = obj[key]
        if (raw === undefined && bound[key] === undefined) continue
        const value = snapshot(raw)
        const refs = [...aliases(bound[key], 'boundVariables.' + key), ...aliases(value, key)]
        const uniqueRefs = refs.filter((ref, i) => refs.findIndex(other => other.path === ref.path && other.variableId === ref.variableId) === i)
        const styleKey = STYLE_FIELDS[key] ?? (TEXT_STYLE_FIELDS.includes(key) ? 'textStyleId' : '')
        const styleId = styleKey && typeof obj[styleKey] === 'string' && obj[styleKey] ? String(obj[styleKey]) : null
        if (styleId) await style(styleId)
        const resolutions: unknown[] = []
        for (const id of new Set(uniqueRefs.map(ref => ref.variableId))) {
          enqueue(id)
          const v = await variable(id)
          if (!v) { resolutions.push({ variableId: id, unavailable: true }); continue }
          try {
            resolutions.push({ variableId: id, name: v.name, collectionId: v.variableCollectionId, activeModeId: consumer.resolvedVariableModes[v.variableCollectionId] ?? null, ...snapshot(v.resolveForConsumer(consumer)) as Dict })
          } catch (error) { warnings.add('Value resolution failed: ' + consumer.id + ' / ' + id + ': ' + message(error)); resolutions.push({ variableId: id, unavailable: true }) }
        }
        // A composite may contain both token-bound and literal subfields: do not claim full coverage.
        const source = raw === figma.mixed ? 'mixed' : uniqueRefs.length ? (typeof raw === 'object' && raw !== null ? 'contains-variable-bindings' : 'variable-bound') : styleId ? 'style-linked' : 'raw'
        result.push({ property: prefix + key, value, source, bindings: uniqueRefs, styleId, resolutions })
      }
      return result
    }
    const stack: { node: SceneNode; path: string[] }[] = selected.slice().reverse().map(node => ({ node, path: [node.name] }))
    const oldSkip = figma.skipInvisibleInstanceChildren
    figma.skipInvisibleInstanceChildren = false
    try {
      for (let n = 0; stack.length && n < MAX_LAYERS; n++) {
        const { node, path } = stack.pop()!
        if (seen.has(node.id)) { n--; continue }
        seen.add(node.id)
        const obj = node as unknown as Dict
        const bounds = snapshot({ x: obj.x, y: obj.y, absoluteBoundingBox: obj.absoluteBoundingBox, absoluteRenderBounds: obj.absoluteRenderBounds, relativeTransform: obj.relativeTransform })
        const component: Dict = {
          key: obj.key ?? null,
          remote: obj.remote ?? null,
          description: obj.description ?? null,
          properties: snapshot(obj.componentProperties),
          variantProperties: snapshot(obj.variantProperties),
          variantGroupProperties: snapshot(obj.variantGroupProperties),
          propertyDefinitions: null
        }
        // Figma throws when reading definitions on a variant (a COMPONENT inside a COMPONENT_SET); they live on the set.
        const isVariant = node.type === 'COMPONENT' && node.parent?.type === 'COMPONENT_SET'
        if ((node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') && !isVariant) {
          try { component.propertyDefinitions = snapshot(obj.componentPropertyDefinitions) }
          catch (error) { warnings.add('Component property definitions unavailable: ' + node.name + ' (' + node.id + '): ' + message(error)) }
        }
        if (node.type === 'INSTANCE') {
          const getMainComponentAsync = obj.getMainComponentAsync
          try {
            const main = typeof getMainComponentAsync === 'function'
              ? record(await (getMainComponentAsync as () => Promise<unknown>).call(node))
              : record(obj.mainComponent)
            component.mainComponent = main.id ? { id: main.id, name: main.name, key: main.key, remote: main.remote, description: main.description } : null
          } catch (error) {
            warnings.add('Main component metadata unavailable: ' + node.id + ': ' + message(error))
            component.mainComponent = null
          }
        }
        const layer: Layer = { id: node.id, name: node.name, type: node.type, parentId: node.parent?.id ?? null, path, visible: node.visible, bounds, component, reactions: snapshot(obj.reactions), resolvedModes: snapshot(node.resolvedVariableModes), explicitModes: snapshot(obj.explicitVariableModes), entries: [], textRanges: [] }
        layer.entries = await entries(obj, record(node.boundVariables), node, '')
        if (node.type === 'TEXT') {
          const ranges = node.getStyledTextSegments(['fontName', 'fontSize', 'fontWeight', 'textCase', 'textDecoration', 'lineHeight', 'letterSpacing', 'fills', 'textStyleId', 'fillStyleId', 'paragraphSpacing', 'paragraphIndent', 'listSpacing', 'boundVariables', 'textStyleOverrides', 'openTypeFeatures'])
          if (ranges.length > 10000) { warnings.add('Text ranges limited to 10000 for layer ' + node.id); truncated = true }
          for (const segment of ranges.slice(0, 10000)) {
            const segmentObj = segment as unknown as Dict
            layer.textRanges.push({ start: segment.start, end: segment.end, characters: segment.characters, textStyleId: segment.textStyleId, textStyleOverrides: snapshot(segment.textStyleOverrides), entries: await entries(segmentObj, record(segment.boundVariables), node, '') })
          }
        }
        layers.push(layer)
        if (descendants && 'children' in node) {
          const children = node.children
          for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], path: [...path, children[i].name] })
        }
        if (layers.length % 50 === 0) { figma.ui.postMessage({ type: 'progress', count: layers.length }); await new Promise(resolve => setTimeout(resolve, 0)) }
      }
      if (stack.length) { warnings.add('Layer limit reached (20000); select a smaller subtree.'); truncated = true }
    } finally { figma.skipInvisibleInstanceChildren = oldSkip }

    for (let i = 0; i < queue.length && i < MAX_VARIABLES; i++) {
      const id = queue[i]
      const v = await variable(id)
      if (!v) { variables[id] = { id, unavailable: true }; continue }
      variables[id] = { id: v.id, key: v.key, name: v.name, description: v.description, remote: v.remote, resolvedType: v.resolvedType, collectionId: v.variableCollectionId, scopes: snapshot(v.scopes), codeSyntax: snapshot(v.codeSyntax), valuesByMode: snapshot(v.valuesByMode) }
      for (const ref of aliases(v.valuesByMode)) enqueue(ref.variableId)
      const collectionId = v.variableCollectionId
      if (!Object.prototype.hasOwnProperty.call(collections, collectionId)) {
        collections[collectionId] = { id: collectionId, unavailable: true }
        try {
          const c = await figma.variables.getVariableCollectionByIdAsync(collectionId)
          if (c) collections[collectionId] = { id: c.id, key: c.key, name: c.name, remote: c.remote, defaultModeId: c.defaultModeId, modes: snapshot(c.modes), isExtension: c.isExtension }
          else warnings.add('Collection unavailable: ' + collectionId)
        } catch (error) { warnings.add('Collection unavailable: ' + collectionId + ': ' + message(error)) }
      }
      if (i % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0))
    }
    let previewImage: Uint8Array | null = null
    if (selected.length === 1) {
      const previewNode = selected[0] as unknown as Dict
      if (typeof previewNode.exportAsync === 'function') {
        try {
          const box = record(previewNode.absoluteBoundingBox)
          const targetWidth = typeof box.width === 'number' ? Math.min(1600, Math.max(1, Math.round(box.width))) : 1200
          const bytes = await (previewNode.exportAsync as (settings: Dict) => Promise<Uint8Array>).call(selected[0], { format: 'PNG', constraint: { type: 'WIDTH', value: targetWidth } })
          if (bytes.byteLength <= MAX_PREVIEW_BYTES) previewImage = bytes
          else warnings.add('Visual preview omitted: PNG exceeds the 8 MB export limit.')
        } catch (error) { warnings.add('Visual preview unavailable: ' + message(error)) }
      } else warnings.add('Visual preview unavailable: the selected node cannot be exported as an image.')
    } else warnings.add('Visual preview omitted: select one root node per scan to export a matching PNG reference.')

    const totals: Record<string, number> = {}
    for (const layer of layers) for (const item of layer.entries) totals[item.source] = (totals[item.source] ?? 0) + 1
    const generatedAt = new Date().toISOString()
    const baseName = 'design-context-' + generatedAt.replace(/[:.]/g, '-')
    const previewFile = previewImage ? baseName + '.png' : null
    const guidance = [
      'This file is an evidence-based implementation brief generated from the selected Figma node and its scanned subtree. Use the rendered PNG alongside this Markdown when available.',
      'Recreate the visible hierarchy, geometry, layout, text, component properties and token usage in the target project. Inspect that project first and reuse its components, tokens and conventions.',
      'Treat captured values as source facts. Do not guess missing interactions, responsive rules, accessibility behavior, assets or code APIs; mark them for design review.',
      'Variable bindings are explicit Figma bindings. No token is inferred from a matching name or value. Styles remain distinct from variables; composite bindings may cover only part of a property.',
      'Preserve variable collection modes, aliases and the consumer-resolved value. Preserve text range overrides and mixed values instead of flattening them.',
      'Lengths are Figma logical pixels unless a unit object says otherwise; RGB(A) channels and opacity use 0..1; rotation uses degrees.',
      'This scan covers only the selected roots, their descendants when enabled, and referenced definitions. It is not a full library dump, production code, or DTCG conformance claim.',
      'PNG preview is a separate file. Keep it beside this Markdown and provide both files to a vision-capable coding agent for visual comparison.',
      'Paint image fills are metadata only. This export does not include source image binaries, vector path data, prototypes, or animation timelines.',
      'Text content is included. Review it before sharing this context with AI services. Warnings and extraction limits are authoritative; do not invent replacements.'
    ]
    const report = { schemaVersion: '1.1.0', format: 'figma-design-context-snapshot', generatedAt, complete: !truncated && warnings.size === 0, truncated, source: { documentName: figma.root.name, pageId: figma.currentPage.id, pageName: figma.currentPage.name, selectionIds: selected.map(n => n.id), includeDescendants: descendants, includeHidden: true, previewFile }, units: { lengths: 'Figma logical px unless unit specified', colors: 'RGB(A) 0..1', opacity: '0..1', rotation: 'degrees' }, summary: { layers: layers.length, variables: Object.keys(variables).length, styles: Object.keys(styles).length, propertyCounts: totals }, guidance, warnings: [...warnings], collections, variables, styles, layers }
    const selectedRoots = layers.filter(layer => selected.some(node => node.id === layer.id))
    const md: string[] = [
      '# Design Context: ' + cell(selectedRoots.map(layer => layer.name).join(', ')),
      '',
      '> AI implementation brief generated from a Figma selection. Follow captured facts, reuse the target codebase, and flag anything this export cannot establish.',
      '',
      '## Source and coverage',
      '- Document: ' + cell(figma.root.name) + ' · page: ' + cell(figma.currentPage.name),
      '- Generated: ' + generatedAt,
      '- Selected root(s): ' + selectedRoots.map(layer => cell(layer.name) + ' (`' + cell(layer.id) + '`, ' + layer.type + ', ' + dimensions(layer) + ')').join('; '),
      '- Scanned layers: ' + layers.length + ' · variables: ' + Object.keys(variables).length + ' · styles: ' + Object.keys(styles).length,
      '- Descendants included: ' + descendants + ' · hidden layers included: true · extraction complete: ' + report.complete,
      '',
      '## AI implementation instructions',
      ...guidance.map(s => '- ' + s),
      '',
      '## Visual reference',
      ...(previewFile ? ['![Rendered Figma selection](' + previewFile + ')', '', 'The PNG is exported at up to 1600 px wide. Keep it beside this file when sharing the design context.'] : ['No PNG was exported. Review the selected node in Figma before implementing visual details.']),
      '',
      '## Component and layout overview',
      '| Node | Type | Bounds (x, y · w × h) | Layout | Visibility |',
      '| --- | --- | --- | --- | --- |'
    ]
    for (const layer of layers) {
      const indent = '　'.repeat(Math.max(0, layer.path.length - 1))
      md.push('| ' + indent + cell(layer.name) + ' (`' + cell(layer.id) + '`) | ' + layer.type + ' | ' + dimensions(layer) + ' | ' + markdownCell(layoutSummary(layer)) + ' | ' + (layer.visible ? 'visible' : 'hidden') + ' |')
    }
    md.push('', '## Component properties and interactions')
    let hasComponentDetails = false
    for (const layer of layers) {
      const component = record(layer.component)
      const hasDetails = component.mainComponent || component.properties || component.variantProperties || component.variantGroupProperties || component.propertyDefinitions || component.key || component.description
      if (hasDetails) {
        hasComponentDetails = true
        md.push('', '### ' + cell(layer.path.join(' / ')) + ' (`' + cell(layer.id) + '`)', '```json', JSON.stringify(componentSummary(layer.component), null, 2), '```')
      }
      if (Array.isArray(layer.reactions) && layer.reactions.length) {
        hasComponentDetails = true
        md.push('', '### Prototype reactions: ' + cell(layer.path.join(' / ')), '```json', JSON.stringify(layer.reactions, null, 2), '```')
      }
    }
    if (!hasComponentDetails) md.push('', 'No component property definitions or prototype reactions were exposed for the scanned nodes. This does not prove the experience has no runtime behavior.')
    md.push('', '## Text content and ranges')
    const textLayers = layers.filter(layer => layer.type === 'TEXT')
    if (!textLayers.length) md.push('', 'No text layers were found in the scanned subtree.')
    for (const layer of textLayers) {
      const content = valueOf(layer, 'characters')
      md.push('', '### ' + cell(layer.path.join(' / ')) + ' (`' + cell(layer.id) + '`)', '', '```text', String(content ?? ''), '```')
      for (const rawRange of layer.textRanges) {
        const range = record(rawRange)
        md.push('', '- Range ' + range.start + '–' + range.end + ': ' + cell(range.characters) + ' · style overrides: ' + cell(range.textStyleOverrides))
      }
    }
    md.push('', '## Variable definitions', '| Token | ID | Collection | Type | Authored values by mode |', '| --- | --- | --- | --- | --- |')
    for (const id of Object.keys(variables)) { const v = record(variables[id]); md.push('| ' + [v.name ?? 'Unavailable', id, v.collectionId ?? null, v.resolvedType ?? null, v.valuesByMode ?? null].map(cell).join(' | ') + ' |') }
    md.push('', '## Collections and modes', '```json', JSON.stringify(collections, null, 2), '```', '', '## Style definitions', '```json', JSON.stringify(styles, null, 2), '```', '', '## Full layer properties')
    function table(items: Entry[]): void {
      md.push('| Property | Source | Actual value (raw where unbound) | Token bindings / resolved values | Style ID |', '| --- | --- | --- | --- | --- |')
      for (const item of items) md.push('| ' + [item.property, item.source, item.value, item.bindings.length ? { bindings: item.bindings, resolutions: item.resolutions } : null, item.styleId].map(cell).join(' | ') + ' |')
    }
    for (const layer of layers) {
      md.push('', '### ' + cell(layer.path.join(' / ')), '- Layer ID: ' + cell(layer.id) + ' (' + layer.type + ')', '- Resolved modes: ' + cell(layer.resolvedModes), '')
      table(layer.entries)
      for (const rawRange of layer.textRanges) {
        const range = record(rawRange)
        md.push('', '#### Text range ' + range.start + '–' + range.end, '- Content: ' + cell(range.characters), '- Style overrides: ' + cell(range.textStyleOverrides), '')
        table(range.entries as Entry[])
      }
    }
    md.push('', '## Warnings and known limits', ...(warnings.size ? [...warnings].map(s => '- ' + cell(s)) : ['- No extraction warnings.']), '', 'An extraction marked complete means no configured scan limit or metadata warning was hit. It does not mean Figma has no unexported visual, behavioral, library, or platform information.')
    figma.ui.postMessage({ type: 'result', runId, markdown: md.join('\n'), json: JSON.stringify(report, null, 2), summary: report.summary, warnings: [...warnings], previewImage, baseName })
  } finally { busy = false; selectionState() }
}

// Install the receiver before creating the iframe: its ready message may arrive immediately.
figma.ui.onmessage = async (msg: Msg) => {
  if (msg.type === 'resize' && typeof msg.height === 'number' && Number.isFinite(msg.height)) { figma.ui.resize(PLUGIN_WIDTH, Math.max(360, Math.min(MAX_PLUGIN_HEIGHT, Math.round(msg.height)))); return }
  if (msg.type === 'ready' || msg.type === 'refresh-selection') { selectionState(); return }
  if (msg.type === 'scan') {
    try { await scan(msg.descendants !== false) }
    catch (error) { figma.ui.postMessage({ type: 'error', message: message(error) }); figma.notify('Export failed. See plugin for details.', { error: true }); throw error }
  }
}
figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
const initialSelection = JSON.stringify(selectionPayload()).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
const html = __html__.replace('<script id="initial-selection" type="application/json">{}</script>', '<script id="initial-selection" type="application/json">' + initialSelection + '</script>')
figma.showUI(html, { width: PLUGIN_WIDTH, height: 360 })
figma.on('selectionchange', () => { selectionState(); figma.ui.postMessage({ type: 'stale' }) })
selectionState()
