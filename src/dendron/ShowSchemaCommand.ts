import { Schema } from "@dendronhq/common-all";
import * as _ from "lodash";
import { ExtensionContext } from "vscode";
import { getWebviewContent } from "../extension";
import { Graph } from "../types";
import { filterNonExistingEdges, getColumnSetting } from "../utils";
import { BaseCommand, getPanel, sendGraph, ShowNodeCommand } from "./base";
import { createWatcher } from "./watcher";
import path = require("path");


export class ShowSchemaCommand extends ShowNodeCommand {
  static id: string = "dendron.showSchemaGraph";

  async execute(context: ExtensionContext, opts?: {silent?: boolean}) {
    const cleanOpts = _.defaults(opts, {silent: false});
    const column = getColumnSetting("showColumn");
    let maybePanel = getPanel("schema");
    let firstLaunch = false;
    if (!maybePanel) {
      maybePanel = this.createPanel("schema", column);
      firstLaunch = true;
    }
    const engine = await this.getEngine();
    const graph: Graph = {
      nodes: [],
      edges: [],
    };
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
    if (!cleanOpts.silent) {
      sendGraph(maybePanel, graph);
    }
    if (firstLaunch) {
      createWatcher(context, maybePanel, graph, "schema");
    }
  }
}