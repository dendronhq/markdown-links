import { ExtensionContext, WebviewPanel, workspace, Uri, window } from "vscode";
import { Graph } from "../types";
import { getColumnSetting } from "../utils";
import { PanelType } from "./types";
import { getPanel, deletePanel } from "./base";

export const createWatcher = (
    context: ExtensionContext,
    panel: WebviewPanel,
    graph: Graph,
    type: PanelType
  ) => {
    if (workspace.rootPath === undefined) {
      return;
    }
  
    // const watcher = workspace.createFileSystemWatcher(
    //   new vscode.RelativePattern(
    //     vscode.workspace.rootPath,
    //     `**/*{${getFileTypesSetting().join(",")}}`
    //   ),
    //   false,
    //   false,
    //   false
    // );
  
    const sendGraph = () => {
      panel.webview.postMessage({
        type: "refresh",
        payload: graph,
      });
    };
  
    // // Watch file changes in case user adds a link.
    // watcher.onDidChange(async (event) => {
    //   await parseFile(graph, event.path);
    //   filterNonExistingEdges(graph);
    //   sendGraph();
    // });
  
    // // Watch file creation in case user adds a new file
    // watcher.onDidCreate(async (event) => {
    //   await parseFile(graph, event.path);
    //   filterNonExistingEdges(graph);
    //   sendGraph();
    // });
  
    // watcher.onDidDelete(async (event) => {
    //   const index = graph.nodes.findIndex((node) => node.path === event.path);
    //   if (index === -1) {
    //     return;
    //   }
  
    //   graph.nodes.splice(index, 1);
    //   graph.edges = graph.edges.filter(
    //     (edge) => edge.source !== event.path && edge.target !== event.path
    //   );
  
    //   sendGraph();
    // });
  
    workspace.onDidOpenTextDocument(async (event) => {
      panel.webview.postMessage({
        type: "fileOpen",
        payload: { path: event.fileName },
      });
    });
  
    // workspace.onDidRenameFiles(async (event) => {
    //   for (const file of event.files) {
    //     const previous = file.oldUri.path;
    //     const next = file.newUri.path;
  
    //     for (const edge of graph.edges) {
    //       if (edge.source === previous) {
    //         edge.source = next;
    //       }
  
    //       if (edge.target === previous) {
    //         edge.target = next;
    //       }
    //     }
  
    //     for (const node of graph.nodes) {
    //       if (node.path === previous) {
    //         node.path = next;
    //       }
    //     }
  
    //     sendGraph();
    //   }
    // });
  
    panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.type === "ready") {
          sendGraph();
        }
        if (message.type === "click") {
          const openPath = Uri.file(message.payload.path);
          const column = getColumnSetting("openColumn");
  
          workspace.openTextDocument(openPath).then((doc) => {
            window.showTextDocument(doc, column);
          });
        }
      },
      undefined,
      context.subscriptions
    );
  
    panel.onDidDispose(() => {
      deletePanel(type, "hierarchy");
    //   watcher.dispose();
    });
  };