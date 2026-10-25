// Every piece has the same shape, so one wildcard types all of them.
declare module "ascii-magic-art/pieces/*.js" {
  import type { DrawFn, PieceMeta } from "ascii-magic-art/lib/types.js";
  export const meta: PieceMeta;
  const create: () => DrawFn;
  export default create;
}
