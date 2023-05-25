/* eslint-disable @typescript-eslint/no-explicit-any */
import { Roarr, ROARR, Message, getLogLevelName } from 'roarr';

export enum LOG_LEVEL {
  trace = 10,
  debug = 20,
  info = 30,
  warn = 40,
  error = 50,
  fatal = 60,
}
const DefaultLogLevelThreshold = LOG_LEVEL.fatal;

export interface ICustormLogger {
  trace(...args: any): void; // corresponds to numeric level 10
  debug(...args: any): void; // corresponds to numeric level 20
  info(...args: any): void; // corresponds to numeric level 30
  warn(...args: any): void; // corresponds to numeric level 40
  error(...args: any): void; // corresponds to numeric level 50
  fatal(...args: any): void; // corresponds to numeric level 60
}
export class LoggerService {
  private thresholdLevel: number;
  private doShowTrace: boolean;
  private logger: ICustormLogger;
  constructor(customLogger?: ICustormLogger) {
    this.thresholdLevel = process.env.REACT_APP_LOGLEVEL
      ? Number(process.env.REACT_APP_LOGLEVEL)
      : DefaultLogLevelThreshold;

    this.doShowTrace =
      String(process.env.REACT_APP_LOGTRACEALL).toUpperCase() === 'TRUE';

    this.logger = customLogger ? customLogger : Roarr;

    ROARR.write = messageStr => {
      const messageJson = JSON.parse(messageStr) as Message;
      const logLevel = Number(messageJson.context.logLevel);
      if (!isNaN(logLevel) && logLevel >= this.thresholdLevel) {
        console.log(
          `[${getLogLevelName(logLevel)}]: ${
            messageJson.message
          } [context]: ${JSON.stringify(messageJson.context)}`,
        );
      }
    };
  }

  private transformArgs(args: Array<any>, doShowStack = false): Array<any> {
    if (!args[0]) return [];
    const res = [];
    const additionalContext = doShowStack ? { stack: new Error().stack } : {};
    if (typeof args[0] === 'object') {
      res.push({ ...args[0], ...additionalContext });
    } else {
      res.push(additionalContext);
      if (typeof args[0] === 'string') {
        res.push(args[0]);
      } else {
        res.push(JSON.stringify(args[0]));
      }
    }

    for (let i = 1; i < args.length; i++) {
      const nextarg =
        typeof args[i] === 'string' ? args[i] : JSON.stringify(args[i]);

      if (!res[1]) {
        res[1] = nextarg;
      } else {
        res[1] += nextarg;
      }
    }
    return res;
  }

  trace(...args: any) {
    this.logger.trace(...this.transformArgs(args));
    this.doShowTrace && console.trace();
  }
  debug(...args: any) {
    this.logger.debug(...this.transformArgs(args));
    this.doShowTrace && console.trace();
  }
  info(...args: any) {
    this.logger.info(...this.transformArgs(args));
    this.doShowTrace && console.trace();
  }
  warn(...args: any) {
    this.logger.warn(...this.transformArgs(args));
    this.doShowTrace && console.trace();
  }
  error(...args: any) {
    this.logger.error(...this.transformArgs(args));
    this.doShowTrace && console.trace();
  }
  fatal(...args: any) {
    this.logger.fatal(...this.transformArgs(args, true));
    console.trace();
  }
}
