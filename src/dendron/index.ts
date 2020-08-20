import { DEngine, Schema } from "@dendronhq/common-all";
import { DendronEngine } from "@dendronhq/engine-server";
import * as _ from "lodash";
import { posix } from "path";
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
import { createWatcher } from "./watcher";
import path = require("path");
import { PanelMode, PanelType } from "./types";
import { setPanel, getPanel, sendGraph } from "./base";

export class ShowSchemaCommand {
  static id: string = "dendron.showSchemaGraph";

  createPanel(type: PanelType, column: ViewColumn): WebviewPanel {
    const mode: PanelMode = "hierarchy";
    const panel = window.createWebviewPanel(
      "dendron",
      `${type} Links`,
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

export const parseSchema = async (graph: Graph, note: Schema) => {
  const index = graph.nodes.findIndex((node) => node.path === note.path);
  const title = note.title;
  if (!title) {
    if (index !== -1) {
      graph.nodes.splice(index, 1);
    }

    return;
  }

  if (index !== -1) {
    graph.nodes[index].label = title;
  } else {
    // add node to graph
    // TODO: temp
    const fullPath = posix.join(
      DendronEngine.getOrCreateEngine().props.root,
      posix.basename(note.uri.authority)
    );
    const node = { id: note.id, path: fullPath, label: title };
    graph.nodes.push(node);
  }

  // Remove edges based on an old version of this file.
  // graph.edges = graph.edges.filter((edge) => edge.source !== note.id);
  note.children.forEach((c) => {
    let target = c;
    graph.edges.push({ source: note.id, target: c.id });
  });
};
