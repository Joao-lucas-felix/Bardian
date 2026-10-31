import { readFileSync } from "node:fs"

// Resolve somente o alias do importmap no Node; executa o módulo de produção real.
const dependency = new URL("../../../app/javascript/composition/region_notes.js", import.meta.url).href
const path = new URL("../../../app/javascript/composition/harmony_editor.js", import.meta.url)
const source = readFileSync(path, "utf8").replace('"composition/harmony_draft"', JSON.stringify(new URL("../../../app/javascript/composition/harmony_draft.js", import.meta.url).href)).replace('"composition/region_notes"', JSON.stringify(dependency))
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)
export const { editorState, applyEditorNotes } = module
