import { DEngine, Schema, DNode } from "@dendronhq/common-all";
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

export function getGraph(
  type: PanelType,
  mode?: PanelMode
): Graph {
  if (!mode) {
    mode = "hierarchy";
  }
  const graph = GRAPHS[type][mode];
  return graph;
}

export function setGraph(
  type: PanelType,
  graph: Graph,
  mode?: PanelMode
) {
  if (!mode) {
    mode = "hierarchy";
  }
  GRAPHS[type][mode] = graph;
}


export function deletePanel(
  type: PanelType,
  mode?: PanelMode
): void {
  if (!mode) {
    mode = "hierarchy";
  }
  PANELS[type][mode] = undefined;
}


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

  async getEngine(forceNew?: boolean): Promise<DEngine> {
    if (workspace.rootPath === undefined) {
      window.showErrorMessage(
        "This command can only be activated in open directory"
      );
      throw Error("");
    }
    const engine = DendronEngine.getOrCreateEngine({
      root: workspace.rootPath,
      forceNew: forceNew ? true : false,
    });
    if (!engine.initialized) {
      await engine.init();
    }
    return engine;
  }
}

export abstract class ShowNodeCommand extends BaseCommand {

  abstract getId(n: DNode): string;
  abstract getLabel(n: DNode): string;
  abstract getExtension(): string;

  async parseGraph(nodes: DNode[], engine: DEngine, graph: Graph): Promise<Graph> {
    const getId = this.getId;
    while (!_.isEmpty(nodes)) {
      const n = nodes.pop() as DNode;
      const fullPath = path.join(engine.props.root, n.fname + this.getExtension());
      const gNote = { id: getId(n), path: fullPath, label: this.getLabel(n) };
      graph.nodes.push(gNote);
      n.children.forEach((c) => {
        graph.edges.push({ source: getId(n), target: getId(c as DNode) });
        nodes.push(c as Schema);
      });
    }
    filterNonExistingEdges(graph);
    return graph;
  }

  abstract async execute(
    context: ExtensionContext,
    opts?: { silent?: boolean }
  ): Promise<void>;
}
