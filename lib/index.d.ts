import { Context } from "@deepseek-ai/cordis";

//#region src/plugin-config.d.ts
/**
 * Standard Schema v1 Config. Loader validates before apply.
 * Avoids a hard schemastery import so the package still typechecks without DSH.
 */
interface Config {
  /** In-process subagent provider name. Default `spawn`. */
  spawnProvider?: string;
}
declare const Config: {
  '~standard': {
    version: 1;
    vendor: string;
    validate(value: unknown): {
      value: {
        spawnProvider: string;
      };
      issues?: undefined;
    } | {
      issues: {
        message: string;
      }[];
      value?: undefined;
    };
  };
};
//#endregion
//#region src/index.d.ts
declare const name = "pstack-dsh";
declare const inject: string[];
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { Config, type Config as ConfigType, apply, inject, name };