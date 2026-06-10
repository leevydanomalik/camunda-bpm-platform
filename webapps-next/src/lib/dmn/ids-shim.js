// Shim — dmn-js-drd, dmn-js-shared, and bpmn-js all do `import Ids from 'ids'`
// but ids@3.x dropped its default export. We alias bare `ids` to this file in
// next.config (turbopack.resolveAlias + webpack alias) so consumers get a
// default.
//
// IMPORTANT: this file MUST NOT use `import { Ids } from "ids"` — under webpack
// the alias matches that bare specifier too and self-references back to this
// shim, recursing until "Maximum call stack size exceeded". Loading via a
// relative file path side-steps the alias (aliases only match bare specifiers).
import { Ids } from "../../../node_modules/ids/dist/index.js";

export { Ids };
export default Ids;
