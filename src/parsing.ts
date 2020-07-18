import * as vscode from "vscode";
import * as path from "path";
import * as unified from "unified";
import * as markdown from "remark-parse";
import * as wikiLinkPlugin from "remark-wiki-link";
import * as frontmatter from "remark-frontmatter";
import { MarkdownNode, Graph } from "./types";
import { TextDecoder } from "util";
import {
  findTitle,
  findLinks,
  id,
  FILE_ID_REGEXP,
  getFileTypesSetting,
} from "./utils";
import { basename, posix } from "path";
import { DendronEngine } from "@dendronhq/engine-server";
import { Note, NodeBuilder } from "@dendronhq/common-all";

let idToPath: Record<string, string> = {};

export const idResolver = (id: string) => {
  const filePath = idToPath[id];
  if (filePath === undefined) {
    return [id];
  } else {
    return [filePath];
  }
};

const parser = unified()
  .use(markdown)
  .use(wikiLinkPlugin, { pageResolver: idResolver })
  .use(frontmatter);

export const parseNote = async (graph: Graph, note: Note) => {
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
    // TODO: temp
    const fullPath = posix.join(
      DendronEngine.getOrCreateEngine().props.root,
      posix.basename(note.uri.authority)
    );
    const node = { id: note.id, path: fullPath, label: title };
    graph.nodes.push(node);
  }

  // Remove edges based on an old version of this file.
  graph.edges = graph.edges.filter((edge) => edge.source !== note.id);
  note.children.forEach((c) => {
    let target = c;
    graph.edges.push({ source: note.id, target: c.id });
  });
};

export const parseFile = async (graph: Graph, filePath: string) => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);
  const ast: MarkdownNode = parser.parse(content);

  let title: string | null = findTitle(ast);

  const index = graph.nodes.findIndex((node) => node.path === filePath);

  if (!title) {
    if (index !== -1) {
      graph.nodes.splice(index, 1);
    }

    return;
  }

  if (index !== -1) {
    graph.nodes[index].label = title;
  } else {
    graph.nodes.push({ id: id(filePath), path: filePath, label: title });
  }

  // Remove edges based on an old version of this file.
  graph.edges = graph.edges.filter((edge) => edge.source !== id(filePath));

  const links = findLinks(ast);
  const parentDirectory = filePath.split("/").slice(0, -1).join("/");

  for (const link of links) {
    let target = link;
    if (!path.isAbsolute(link)) {
      target = path.normalize(`${parentDirectory}/${link}`);
    }

    graph.edges.push({ source: id(filePath), target: id(target) });
  }
};

export const findFileId = async (filePath: string): Promise<string | null> => {
  const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
  const content = new TextDecoder("utf-8").decode(buffer);

  const match = content.match(FILE_ID_REGEXP);
  return match ? match[1] : null;
};

export const learnFileId = async (_graph: Graph, filePath: string) => {
  const id = await findFileId(filePath);
  if (id !== null) {
    idToPath[id] = filePath;
  }

  const fileName = basename(filePath);
  idToPath[fileName] = filePath;

  const fileNameWithoutExt = fileName.split(".").slice(0, -1).join(".");
  idToPath[fileNameWithoutExt] = filePath;
};

export const parseEngine = async (
  graph: Graph,
  fileCallback: (graph: Graph, note: Note) => Promise<void>
) => {
  const notes = Object.values(DendronEngine.getOrCreateEngine().notes);
  await Promise.all(
    notes.map((n) => {
      return fileCallback(graph, n);
    })
  );
  return;
};

export const parseDirectory = async (
  graph: Graph,
  directory: string,
  fileCallback: (graph: Graph, path: string) => Promise<void>
) => {
  const files = await vscode.workspace.fs.readDirectory(
    vscode.Uri.file(directory)
  );

  const promises: Promise<void>[] = [];

  for (const file of files) {
    const fileName = file[0];
    const fileType = file[1];
    const isDirectory = fileType === vscode.FileType.Directory;
    const isFile = fileType === vscode.FileType.File;
    const hiddenFile = fileName.startsWith(".");
    const isGraphFile = getFileTypesSetting().includes(
      fileName.substr(fileName.lastIndexOf(".") + 1)
    );

    if (isDirectory && !hiddenFile) {
      promises.push(
        parseDirectory(graph, `${directory}/${fileName}`, fileCallback)
      );
    } else if (isFile && isGraphFile) {
      promises.push(fileCallback(graph, `${directory}/${fileName}`));
    }
  }

  await Promise.all(promises);
};
