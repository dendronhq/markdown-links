import { EngineConnector } from "@dendronhq/engine-server";
import _ = require("lodash");
import { ExtensionContext, window } from "vscode";

export class SyncGraphCommand {
  static id: string = "dendron.syncGraph";

  async execute(_context: ExtensionContext) {
    const connector = EngineConnector.instance();
    if (_.isUndefined(connector._engine) || !connector.initialized) {
      window.showInformationMessage(
        "still connecting to engine. please try again in a few moments..."
      );
      return;
    }
    await connector.engine.sync();
    window.showInformationMessage(
        "updated graph"
    );
  }
}
