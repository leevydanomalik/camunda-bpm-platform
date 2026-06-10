// Token Simulation — capability `cockpit.diagram.token-simulation`.
// Wraps bpmn-js-token-simulation's viewer module. The heavy library (and its
// stylesheet) load lazily, and only ever when the plugin is installed — the
// core BpmnViewer just spreads the returned module into `additionalModules`.

export async function loadTokenSimulationModule(): Promise<unknown> {
  await import("bpmn-js-token-simulation/assets/css/bpmn-js-token-simulation.css");
  const mod = await import("bpmn-js-token-simulation/lib/viewer");
  return (mod as { default?: unknown }).default ?? mod;
}
