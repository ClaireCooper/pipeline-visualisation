declare module "cytoscape-svg" {
  import type cytoscape from "cytoscape";
  const plugin: cytoscape.Ext;
  export default plugin;
}
declare module "cytoscape" {
  interface Core {
    svg(options?: {
      full?: boolean;
      scale?: number;
      bg?: string;
      output?: string;
    }): string;
  }
}
