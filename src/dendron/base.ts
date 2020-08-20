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
  abstract async execute(
    context: ExtensionContext,
    opts?: { silent?: boolean }
  ): Promise<void>;
}
