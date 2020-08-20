import { BaseCommand } from "./base";
import { ExtensionContext, window } from "vscode";
import { ShowNotesCommand } from "./ShowNotesCommand";
import { ShowSchemaCommand } from "./ShowSchemaCommand";

export class ReloadGraphCommand extends BaseCommand {
    static id: string = "dendron.reloadGraphs";

    async execute(context: ExtensionContext) {
        const engine = await this.getEngine(true);
        await new ShowNotesCommand().execute(context);
        await new ShowSchemaCommand().execute(context);
        window.showInformationMessage(`graphs reloaded`);
        return;
    }

}
