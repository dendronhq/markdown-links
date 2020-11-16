import { getStage, setEnv } from "@dendronhq/common-all";
import * as fs from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import { ExtensionContext, OutputChannel, window, workspace } from "vscode";

const DENDRON_CHANNEL_NAME = "DENDRON";
const CONFIG = {
    LOG_LEVEL: {
        key: "foo"
    }
};
export type TraceLevel = "debug" | "info" | "warn" | "error" | "fatal";
const levels = ["debug", "info", "warn", "error", "fatal"];

export const UNKNOWN_ERROR_MSG = `You found a bug! We didn't think this could happen but you proved us wrong. Please file the bug here -->  https://github.com/dendronhq/dendron/issues/new?assignees=&labels=&template=bug_report.md&title= We will put our best bug exterminators on this right away!`;

export class Logger {
  static output: OutputChannel | undefined;
  static logPath?: string;

  static configure(context: ExtensionContext, level: TraceLevel) {
    const ctx = "Logger:configure";
    fs.ensureDirSync(context.logPath);
    const logPath = path.join(context.logPath, "dendron.log");
    if (fs.existsSync(logPath)) {
      fs.moveSync(logPath, `${logPath}.old`, { overwrite: true });
    }
    fs.ensureFileSync(logPath);
    let log_level: string;
    if (getStage() === "test") {
      log_level = process.env["LOG_LEVEL"] || "debug";
    } else {
      const conf = workspace.getConfiguration();
      log_level = conf.get<string>(CONFIG.LOG_LEVEL.key) || "info";
    }
    setEnv("LOG_DST", logPath);
    setEnv("LOG_LEVEL", log_level);
    Logger.logPath = logPath;
    // this.logger = createLogger("dendron", logPath);
    this.level = level;
    Logger.info({ ctx, msg: "exit", log_level });
  }
  private static _level: TraceLevel = "debug";

  static cmpLevel(lvl: TraceLevel): boolean {
    return levels.indexOf(lvl) >= levels.indexOf(Logger.level || "debug");
  }

  /**
   * Is lvl1 >= lvl2
   * @param lvl1
   * @param lvl2
   */
  static cmpLevels(lvl1: TraceLevel, lvl2: TraceLevel): boolean {
    return levels.indexOf(lvl1) >= levels.indexOf(lvl2);
  }

  static get level() {
    return this._level;
  }
  static set level(value: TraceLevel) {
    this._level = value;
    this.output =
      this.output || window.createOutputChannel(DENDRON_CHANNEL_NAME);
  }

  // private static lvl2Method = (lvl: TraceLevel) => {
  //     return {
  //         [NoSilentTraceLevel.Debug]: 'debug',
  //         [NoSilentTraceLevel.Info]: 'info',
  //         [NoSilentTraceLevel.Warn]: 'warn',
  //         [NoSilentTraceLevel.Error]: 'error',
  //         [NoSilentTraceLevel.Fatal]: 'fatal',
  //     }[lvl];
  // }

  static error(msg: any) {
    Logger.log(msg, "error");
  }

  static info(msg: any, show?: boolean) {
    Logger.log(msg, "info", { show });
  }

  static debug(msg: any) {
    Logger.log(msg, "debug");
  }

  static log = (msg: any, lvl: TraceLevel, _opts?: { show?: boolean }) => {
    if (Logger.cmpLevel(lvl)) {
      let stringMsg = customStringify(msg);
      // Logger.logger && Logger.logger[lvl](msg);
      Logger.output?.appendLine(lvl + ": " + stringMsg);
      // FIXME: disable for now
      const shouldShow = false; // getStage() === "dev" && cleanOpts.show;
      if (shouldShow || Logger.cmpLevels(lvl, "error")) {
        let cleanMsg = stringMsg;
        if (Logger.cmpLevels(lvl, "error")) {
          if (!_.isUndefined(msg?.friendly)) {
            cleanMsg = msg.friendly;
          }
          if (!_.isUndefined(msg?.err?.friendly)) {
            cleanMsg = msg.err.friendly;
          }
          window.showErrorMessage(cleanMsg);
        } else if (Logger.cmpLevels(lvl, "info")) {
          window.showInformationMessage(cleanMsg);
        }
      }
    }
  };
}

const customStringify = function (v: any) {
  const cache = new Set();
  return JSON.stringify(v, function (_key, value) {
    if (typeof value === "object" && value !== null) {
      if (cache.has(value)) {
        // Circular reference found
        try {
          // If this value does not reference a parent it can be deduped
          return JSON.parse(JSON.stringify(value));
        } catch (err) {
          // discard key if value cannot be deduped
          return;
        }
      }
      // Store value in our set
      cache.add(value);
    }
    return value;
  });
};
