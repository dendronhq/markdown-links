import {
  DEngineClientV2,
  DNodePropsV2,
  NotePropsV2,
  NoteUtilsV2,
  SchemaModulePropsV2,
  SchemaPropsV2,
  SchemaUtilsV2,
} from "@dendronhq/common-all";
// import { DendronEngine } from "@dendronhq/engine-server";
import { EngineConnector, getWSMetaFilePath } from "@dendronhq/engine-server";
import * as fs from "fs";
import * as _ from "lodash";
import * as vscode from "vscode";
import { ExtensionContext, ViewColumn, WebviewPanel, window } from "vscode";
import { Graph } from "../types";
import { filterNonExistingEdges } from "../utils";
import { PanelMode, PanelType } from "./types";
import path = require("path");

const PANELS: {
  [key in PanelType]: { [key in PanelMode]: undefined | WebviewPanel };
} = {
  NotePropsV2: {
    hierarchy: undefined,
  },
  schema: {
    hierarchy: undefined,
  },
};

const GRAPHS: {
  [key in PanelType]: { [key in PanelMode]: Graph };
} = {
  NotePropsV2: {
    hierarchy: { nodes: [], edges: [] },
  },
  schema: {
    hierarchy: { nodes: [], edges: [] },
  },
};

export function getGraph(type: PanelType, mode?: PanelMode): Graph {
  if (!mode) {
    mode = "hierarchy";
  }
  const graph = GRAPHS[type][mode];
  return graph;
}

export function setGraph(type: PanelType, graph: Graph, mode?: PanelMode) {
  if (!mode) {
    mode = "hierarchy";
  }
  GRAPHS[type][mode] = graph;
}

export function deletePanel(type: PanelType, mode?: PanelMode): void {
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

export async function setupDendron(context: vscode.ExtensionContext) {
  const wsRoot = path.dirname(
    vscode.workspace?.workspaceFile?.fsPath as string
  );
  const vaults = (vscode.workspace.workspaceFolders || []).map((v) => ({
    fsPath: v.uri.fsPath,
  }));
  const fpath = getWSMetaFilePath({ wsRoot });
  if (fs.existsSync(fpath)) {
    const connector = new EngineConnector({ wsRoot, vaults });
    await connector.init({
      onReady: async () => {
        console.log("ready");
        setInterval(async () => {
          connector.engine.sync();
        }, 5000);
      },
    });
  }
}

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

  async getEngine(): Promise<DEngineClientV2 | undefined> {
    const connector = EngineConnector.instance();
    if (_.isUndefined(connector._engine) || !connector.initialized) {
      vscode.window.showInformationMessage(
        "still connecting to engine. please try again in a few moments..."
      );
      return;
    }
    return connector._engine;
  }
}

export abstract class ShowNodeCommand extends BaseCommand {
  public abstract type: "note" | "schema";

  abstract getId(n: NotePropsV2|SchemaPropsV2): string;
  abstract getLabel(n: NotePropsV2|SchemaPropsV2): string;
  abstract getExtension(): string;

  async parseGraph(
    nodes: SchemaModulePropsV2[]|NotePropsV2[],
    engine: DEngineClientV2,
    graph: Graph
  ): Promise<Graph> {
    const getId = this.getId;
    while (!_.isEmpty(nodes)) {
      const n = nodes.pop();
      if (this.type === "note") {
        const note = n as NotePropsV2;
        const fullPath = NoteUtilsV2.getPath({ note });
        const gNote = {
          id: getId(note),
          path: fullPath,
          label: this.getLabel(note),
        };
        graph.nodes.push(gNote);
        note.children.forEach((c) => {
          const child = engine.notes[c] as NotePropsV2;
          graph.edges.push({ source: getId(note), target: getId(child) });
          (nodes as NotePropsV2[]).push(child);
        });
      } else {
        const schemaModule = n as SchemaModulePropsV2;
        const root = schemaModule.vault.fsPath;
        const fname = schemaModule.fname;
        const fullPath = SchemaUtilsV2.getPath({root, fname});
        let schema = schemaModule.root;
        const gNote = {
          id: getId(schema),
          path: fullPath,
          label: this.getLabel(schema),
        };
        graph.nodes.push(gNote);
        schema.children.forEach((c) => {
          const child = schemaModule.schemas[c] as SchemaPropsV2;
          graph.edges.push({ source: getId(schema), target: getId(child) });
          (nodes as SchemaPropsV2[]).push(child);
        });
      }
    }
    filterNonExistingEdges(graph);
    return graph;
  }

  abstract async execute(
    context: ExtensionContext,
    opts?: { silent?: boolean }
  ): Promise<void>;
}
