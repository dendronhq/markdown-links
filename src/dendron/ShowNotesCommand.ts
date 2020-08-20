import { BaseCommand, getPanel, sendGraph, ShowNodeCommand, getGraph } from "./base";
import { ExtensionContext } from "vscode";
import { getColumnSetting, filterNonExistingEdges } from "../utils";
import { Graph } from "../types";
import { Note, DEngine, DNode } from "@dendronhq/common-all";
import path = require("path");
import { getWebviewContent } from "../extension";
import { createWatcher } from "./watcher";
import * as _ from 'lodash';

export class ShowNotesCommand extends ShowNodeCommand {
  static id: string = "dendron.showNoteGraph";

  getId = (s: Note) => `${s.fname}.${s.id}`;
  getLabel = (n: Note) => `${n.title}`;
  getExtension = () => `.md`;

  getNodes(engine: DEngine): DNode[] {
    const root = engine.notes['root'];
    if (!root) {
      throw Error(`no root schema found`);
    }
    return [root];
  }

  async execute(context: ExtensionContext, opts?: {silent?: boolean}) {
    const cleanOpts = _.defaults(opts, {silent: false});
    const column = getColumnSetting("showColumn");
    let maybePanel = getPanel("note");
    const type = "note";
    let firstLaunch = false;
    if (!maybePanel) {
      maybePanel = this.createPanel("note", column);
      firstLaunch = true;
    }
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
      createWatcher(context, maybePanel, graph, "note");
    }
  }
}
