import { BaseCommand, getPanel, sendGraph } from "./base";
import { ExtensionContext } from "vscode";
import { getColumnSetting, filterNonExistingEdges } from "../utils";
import { Graph } from "../types";
import { Note } from "@dendronhq/common-all";
import path = require("path");
import { getWebviewContent } from "../extension";
import { createWatcher } from "./watcher";
import * as _ from 'lodash';

export class ShowNotesCommand extends BaseCommand {
  static id: string = "dendron.showNoteGraph";

  async execute(context: ExtensionContext) {
    const column = getColumnSetting("showColumn");
    let maybePanel = getPanel("note");
    if (!maybePanel) {
      maybePanel = this.createPanel("note", column);
    }
    const engine = await this.getEngine();
    const graph: Graph = {
      nodes: [],
      edges: [],
    };
    const noteDict = engine.notes;
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
    sendGraph(maybePanel, graph);
    createWatcher(context, maybePanel, graph);
  }
}
