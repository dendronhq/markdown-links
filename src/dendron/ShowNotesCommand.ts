import { BaseCommand, getPanel, sendGraph, ShowNodeCommand } from "./base";
import { ExtensionContext } from "vscode";
import { getColumnSetting, filterNonExistingEdges } from "../utils";
import { Graph } from "../types";
import { Note } from "@dendronhq/common-all";
import path = require("path");
import { getWebviewContent } from "../extension";
import { createWatcher } from "./watcher";
import * as _ from 'lodash';

export class ShowNotesCommand extends ShowNodeCommand {
  static id: string = "dendron.showNoteGraph";

  async execute(context: ExtensionContext, opts?: {silent?: boolean}) {
    const cleanOpts = _.defaults(opts, {silent: false});
    const column = getColumnSetting("showColumn");
    let maybePanel = getPanel("note");
    let firstLaunch = false;
    if (!maybePanel) {
      maybePanel = this.createPanel("note", column);
      firstLaunch = true;
    }
    const engine = await this.getEngine();
    const graph: Graph = {
      nodes: [],
      edges: [],
    };
    const root = engine.notes['root'];
    if (!root) {
      throw Error(`no root note found`);
    }
    const nodes = [root];
    const getId = (s: Note) => `${s.fname}.${s.id}`;
    while (!_.isEmpty(nodes)) {
      const n = nodes.pop() as Note;
      const fullPath = path.join(engine.props.root, n.fname + ".md");
      const gNote = { id: getId(n), path: fullPath, label: n.title };
      graph.nodes.push(gNote);
      n.children.forEach((c) => {
        graph.edges.push({ source: getId(n), target: getId(c as Note) });
        nodes.push(c as Note);
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
      createWatcher(context, maybePanel, graph, "note");
    }
  }
}
