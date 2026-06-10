import { createElement } from "react";

import { pluginsForPoint } from "./registry";

/** Host-side slot. Renders every plugin registered for this extension point,
 *  in priority order. Plugins receive `props` directly. */
export function ExtensionSlot({
  point,
  props,
  fallback,
}: {
  point: string;
  props?: Record<string, unknown>;
  fallback?: React.ReactNode;
}) {
  const matches = pluginsForPoint(point);
  if (matches.length === 0) return <>{fallback ?? null}</>;

  return (
    <>
      {matches.map(({ plugin, extension }) => {
        const Comp = plugin.clientExports[extension.exportName];
        if (!Comp) {
          // Plugin manifest references an export that doesn't exist — surface in dev console.
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              `Plugin "${plugin.manifest.id}" declares exportName="${extension.exportName}" for point "${point}" but it isn't exported.`,
            );
          }
          return null;
        }
        return createElement(Comp, { key: `${plugin.manifest.id}:${extension.point}`, ...(props ?? {}) });
      })}
    </>
  );
}
