import { BaseCommand, getPanel, sendGraph, ShowNodeCommand, getGraph } from "./base";
import { ExtensionContext } from "vscode";
import { getColumnSetting, filterNonExistingEdges } from "../utils";
import { Graph } from "../types";
import { NotePropsV2, DEngineClientV2, DNodePropsV2, NoteUtilsV2, DNodeUtilsV2 } from "@dendronhq/common-all";
import path = require("path");
import { getWebviewContent } from "../extension";
import { createWatcher } from "./watcher";
import * as _ from 'lodash';

export class ShowNotesCommand extends ShowNodeCommand {
  static id: string = "dendron.showNoteGraph";
  public type: "note"|"schema";

  getId = (s: NotePropsV2) => `${s.fname}.${s.id}`;
  getLabel = (n: NotePropsV2) => `${n.title}`;
  getExtension = () => `.md`;

  constructor() {
    super();
    this.type = "note";
  }

  getNodes(engine: DEngineClientV2): DNodePropsV2[] {
    const roots = _.filter(engine.notes, DNodeUtilsV2.isRoot);
    if (_.isEmpty(roots)) {
      throw Error(`no root found for notes`);
    }
    return roots;
  }

  async execute(context: ExtensionContext, opts?: {silent?: boolean}) {
    const cleanOpts = _.defaults(opts, {silent: false});
    const column = getColumnSetting("showColumn");
    let maybePanel = getPanel("NotePropsV2");
    const type = "NotePropsV2";
    let firstLaunch = false;
    if (!maybePanel) {
      maybePanel = this.createPanel("NotePropsV2", column);
      firstLaunch = true;
    }
    const engine = await this.getEngine();
    if (!engine) {
      return;
    }
    const graph = { nodes: [], edges: [] };
    const nodes = this.getNodes(engine);
    this.parseGraph(nodes, engine, graph);
    maybePanel.webview.html = await getWebviewContent(
      context,
      maybePanel,
    );
    if (!cleanOpts.silent) {
      sendGraph(maybePanel, graph);
    }
    if (firstLaunch) {
      createWatcher(context, maybePanel, graph, "NotePropsV2");
    }
  }
}
