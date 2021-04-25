import {
  DEngineClientV2,
  DNodePropsV2,
  DNodeUtilsV2,
  NotePropsV2
} from "@dendronhq/common-all";
import * as _ from "lodash";
import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import { getWebviewContent } from "../extension";
import { getColumnSetting } from "../utils";
import { getPanel, sendGraph, ShowNodeCommand } from "./base";
import { createWatcher } from "./watcher";
import path = require("path");

export class ShowNotesCommand extends ShowNodeCommand {
  static id: string = "dendron.showNoteGraph";
  public type: "note" | "schema";

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

  async execute(
    context: ExtensionContext,
    opts?: { silent?: boolean; sync?: boolean }
  ) {
    const engine = await this.getEngine();
    if (!engine) {
      return;
    }
    if (opts?.sync) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Syncing...",
          cancellable: false,
        },
        () => {
          return engine.sync();
        }
      );
    }
    const cleanOpts = _.defaults(opts, { silent: false });
    const column = getColumnSetting("showColumn");
    let maybePanel = getPanel("Notes");
    let firstLaunch = false;
    if (!maybePanel) {
      maybePanel = this.createPanel("Notes", column);
      firstLaunch = true;
    }
    const graph = { nodes: [], edges: [] };
    const nodes = this.getNodes(engine);
    this.parseGraph(nodes, engine, graph);
    maybePanel.webview.html = await (
      opts?.sync ? getWebviewContent(
        context, maybePanel
      ) : vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Loading...",
          cancellable: false,
        },
        () => {
          return getWebviewContent(context, maybePanel);
        }
      )
    );
    if (!cleanOpts.silent) {
      sendGraph(maybePanel, graph);
    }
    if (firstLaunch) {
      createWatcher(context, maybePanel, graph, "Notes");
    }
  }
}
