import {
  DEngineClientV2,
  DNodePropsV2,
  DNodeUtilsV2,
  SchemaModulePropsV2,
  SchemaPropsV2,
  SchemaUtilsV2,
} from "@dendronhq/common-all";
import * as _ from "lodash";
import { ExtensionContext } from "vscode";
import { getWebviewContent } from "../extension";
import { Graph } from "../types";
import { filterNonExistingEdges, getColumnSetting } from "../utils";
import { getPanel, sendGraph, ShowNodeCommand } from "./base";
import { createWatcher } from "./watcher";
import path = require("path");

export class ShowSchemaCommand extends ShowNodeCommand {
  static id: string = "dendron.showSchemaGraph";
  public type: "note" | "schema";

  constructor() {
    super();
    this.type = "schema";
  }

  getNodes(engine: DEngineClientV2): DNodePropsV2[] {
    const schemas = engine.schemas;
    const domains = _.reject(schemas, DNodeUtilsV2.isRoot);
    const nodes = domains;
    return nodes;
  }

  getId = (s: SchemaPropsV2) => `${s.id}`;
  getLabel = (n: SchemaPropsV2) => `${n.title}`;
  getExtension = () => `.yml`;

  async execute(context: ExtensionContext, opts?: { silent?: boolean }) {
    const cleanOpts = _.defaults(opts, { silent: false });
    const column = getColumnSetting("showColumn");
    let maybePanel = getPanel("schema");
    let firstLaunch = false;
    if (!maybePanel) {
      maybePanel = this.createPanel("schema", column);
      firstLaunch = true;
    }
    const type = "schema";
    const engine = await this.getEngine();
    if (!engine) {
      return;
    }
    const graph = { nodes: [], edges: [] };
    const nodes = (this.getNodes(engine) as unknown) as SchemaModulePropsV2[];
    await Promise.all(
      nodes.map((schemaMod) => {
        const schema = schemaMod.root;
        return this.parseGraphV2({ schema, schemaMod, graph });
      })
    );
    filterNonExistingEdges(graph);
    maybePanel.webview.html = await getWebviewContent(context, maybePanel);
    if (!cleanOpts.silent) {
      sendGraph(maybePanel, graph);
    }
    if (firstLaunch) {
      createWatcher(context, maybePanel, graph, "schema");
    }
  }
  parseGraphV2({
    schema,
    schemaMod,
    graph,
  }: {
    schema: SchemaPropsV2;
    schemaMod: SchemaModulePropsV2;
    graph: Graph;
  }) {
    const fname = schemaMod.fname;
    const root = schemaMod.vault.fsPath;
    const fullPath = SchemaUtilsV2.getPath({ root, fname });
    const gNote = {
      id: this.getId(schema),
      path: fullPath,
      label: this.getLabel(schema),
    };
    graph.nodes.push(gNote);
    return schema.children.forEach((c) => {
      const child = schemaMod.schemas[c] as SchemaPropsV2;
      graph.edges.push({
        source: this.getId(schema),
        target: this.getId(child),
      });
      return this.parseGraphV2({ schema: child, schemaMod, graph });
    });
  }

  // async parseGraph(
  //   schemas: SchemaPropsV2,
  //   engine: DEngineClientV2,
  //   graph: Graph,
  //   schemaMod: SchemaModulePropsV2,
  // ): Promise<Graph> {
  //   const getId = this.getId;
  //   while (!_.isEmpty(nodes)) {
  //     const n = nodes.pop();
  //       const schemaModule = n as SchemaModulePropsV2;
  //       const root = schemaModule.vault.fsPath;
  //       const fname = schemaModule.fname;
  //       const fullPath = SchemaUtilsV2.getPath({root, fname});
  //       let schema = schemaModule.root;
  //       const gNote = {
  //         id: getId(schema),
  //         path: fullPath,
  //         label: this.getLabel(schema),
  //       };
  //       graph.nodes.push(gNote);
  //       schema.children.forEach((c) => {
  //         const child = schemaModule.schemas[c] as SchemaPropsV2;
  //         graph.edges.push({ source: getId(schema), target: getId(child) });
  //         (nodes as SchemaPropsV2[]).push(child);
  //       });
  //   }
  //   filterNonExistingEdges(graph);
  //   return graph;
  // }
}
