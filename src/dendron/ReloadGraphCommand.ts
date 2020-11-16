import { BaseCommand, getGraph, getPanel, sendGraph, ShowNodeCommand } from "./base";
import { ExtensionContext, window } from "vscode";
import { ShowNotesCommand } from "./ShowNotesCommand";
import { ShowSchemaCommand } from "./ShowSchemaCommand";
import { PanelType } from "./types";

export class ReloadGraphCommand extends BaseCommand {
    static id: string = "dendron.reloadGraphs";

    async execute(context: ExtensionContext) {
        const engine = await this.getEngine();
        if (!engine) {
            return;
        }
        await engine.init();
        await Promise.all((["schema", "NotePropsV2"] as const).map( async (ntype: PanelType) => {
            const panel = getPanel(ntype);
            if (panel) {
                let cmd: ShowSchemaCommand|ShowNotesCommand;
                if (ntype === "schema") {
                    cmd = new ShowSchemaCommand();
                } else {
                    cmd = new ShowNotesCommand();
                }
                const nodes = cmd.getNodes(engine);
                const graph = await cmd.parseGraph(nodes, engine, { nodes: [], edges: [] });
                window.showInformationMessage(`reload ${ntype}`);
                return sendGraph(panel, graph);
            }
        }));
        return;
    }

}
