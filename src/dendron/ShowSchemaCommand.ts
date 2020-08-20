import { Schema, DNode, DEngine } from "@dendronhq/common-all";
import * as _ from "lodash";
import { ExtensionContext } from "vscode";
import { getWebviewContent } from "../extension";
import { Graph, Node } from "../types";
import { filterNonExistingEdges, getColumnSetting } from "../utils";
import { BaseCommand, getPanel, sendGraph, ShowNodeCommand, getGraph } from "./base";
import { createWatcher } from "./watcher";
import path = require("path");


export class ShowSchemaCommand extends ShowNodeCommand {
  static id: string = "dendron.showSchemaGraph";

  getNodes(engine: DEngine): DNode[] {
    const schemas = engine.schemas;
    const root = engine.schemas['root'];
    if (!root) {
      throw Error(`no root schema found`);
    }
    const domains = _.reject(schemas, { id: "root" });
    domains.forEach((d) => {
      root.addChild(d);
    });
    const nodes = [root];
    return nodes;
  }

  getId = (s: Schema) => `${s.fname}.${s.id}`;
  getLabel = (n: Schema) => `${n.id}`;
  getExtension = () => `.yml`;

  async execute(context: ExtensionContext, opts?: {silent?: boolean}) {
    const cleanOpts = _.defaults(opts, {silent: false});
    const column = getColumnSetting("showColumn");
    let maybePanel = getPanel("schema");
    let firstLaunch = false;
    if (!maybePanel) {
      maybePanel = this.createPanel("schema", column);
      firstLaunch = true;
    }
    const type = "schema";
    const engine = await this.getEngine();
    const graph = { nodes: [], edges: [] };
    const nodes = this.getNodes(engine);
    this.parseGraph(nodes, engine, graph);
    maybePanel.webview.html = await getWebviewContent(
      context,
      maybePanel,
      graph
    );
    if (!cleanOpts.silent) {
      sendGraph(maybePanel, graph);
    }
    if (firstLaunch) {
      createWatcher(context, maybePanel, graph, "schema");
    }
  }
}