import { DEngine, Schema } from "@dendronhq/common-all";
import { DendronEngine } from "@dendronhq/engine-server";
import * as _ from "lodash";
import {
  ExtensionContext,
  ViewColumn,
  WebviewPanel,
  window,
  workspace,
} from "vscode";
import { getWebviewContent } from "../extension";
import { Graph } from "../types";
import { filterNonExistingEdges, getColumnSetting } from "../utils";
import { PanelMode, PanelType } from "./types";
import { createWatcher } from "./watcher";
import path = require("path");

const PANELS: {
  [key in PanelType]: { [key in PanelMode]: undefined | WebviewPanel };
} = {
  note: {
    hierarchy: undefined,
  },
  schema: {
    hierarchy: undefined,
  },
};

const GRAPHS: {
  [key in PanelType]: { [key in PanelMode]: Graph };
} = {
  note: {
    hierarchy: { nodes: [], edges: [] },
  },
  schema: {
    hierarchy: { nodes: [], edges: [] },
  },
};


export function getPanel(
    type: PanelType,
    mode?: PanelMode
  ): WebviewPanel | undefined {
    if (!mode) {
      mode = "hierarchy";
    }
    const maybePanel = PANELS[type][mode];
    return maybePanel;
  }
  
  export function setPanel(
    type: PanelType,
    panel: WebviewPanel,
    mode?: PanelMode
  ) {
    if (!mode) {
      mode = "hierarchy";
    }
    PANELS[type][mode] = panel;
  }
  
  export const sendGraph = (panel: WebviewPanel, graph: Graph) => {
    panel.webview.postMessage({
      type: "refresh",
      payload: graph,
    });
  };

  

export class BaseCommand {
  createPanel(type: PanelType, column: ViewColumn): WebviewPanel {
    const mode: PanelMode = "hierarchy";
    const panel = window.createWebviewPanel(
      "dendron",
      `${_.capitalize(type)} Links`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );
    setPanel(type, panel, mode);
    return panel;
  }

  async getEngine(): Promise<DEngine> {
    if (workspace.rootPath === undefined) {
      window.showErrorMessage(
        "This command can only be activated in open directory"
      );
      throw Error("");
    }
    const engine = DendronEngine.getOrCreateEngine({
      root: workspace.rootPath,
    });
    if (!engine.initialized) {
      await engine.init();
    }
    return engine;
  }

  async execute(context: ExtensionContext) {
    const column = getColumnSetting("showColumn");
    let maybePanel = getPanel("schema");
    if (!maybePanel) {
      maybePanel = this.createPanel("schema", column);
    }
    const engine = await this.getEngine();
    const graph: Graph = {
      nodes: [],
      edges: [],
    };
    //await parseEngine(graph, parseNote);
    // get all domains
    const schemaDict = engine.schemas;
    const schemas = Object.values(schemaDict);
    const root = _.find(schemas, { id: "root" });
    if (!root) {
      throw Error(`no root schema found`);
    }
    const domains = _.reject(schemas, { id: "root" });
    domains.forEach((d) => {
      root.addChild(d);
    });
    const nodes = [root];
    const getId = (s: Schema) => `${s.fname}.${s.id}`;
    while (!_.isEmpty(nodes)) {
      const n = nodes.pop() as Schema;
      const fullPath = path.join(engine.props.root, n.fname + ".yml");
      const gNote = { id: getId(n), path: fullPath, label: n.id };
      graph.nodes.push(gNote);
      n.children.forEach((c) => {
        graph.edges.push({ source: getId(n), target: getId(c as Schema) });
        nodes.push(c as Schema);
      });
    }
    filterNonExistingEdges(graph);
    maybePanel.webview.html = await getWebviewContent(
      context,
      maybePanel,
      graph
    );
    sendGraph(maybePanel, graph);
    createWatcher(context, maybePanel, graph);
  }
}
