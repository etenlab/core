import { DataSource } from 'typeorm';
import localforage from 'localforage';

declare global {
  interface Window {
    localforage?: LocalForage;
  }
}

export class DbService {
  // todo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localForage: any;
  // eslint-disable-next-line @typescript-eslint/ban-types
  private readonly startupSubscriptions: Function[] = [];

  constructor(public readonly dataSource: DataSource) {
    window.localforage = localforage;
    this.localForage = localforage;
    localforage.config({
      description: 'user',
      driver: localforage.INDEXEDDB,
    });
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  onStartup(fn: Function) {
    this.startupSubscriptions.push(fn);
  }

  status() {}
}
