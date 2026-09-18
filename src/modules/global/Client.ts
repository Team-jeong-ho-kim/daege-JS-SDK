import { EventMap, Events } from "./Events.ts";

interface ClientOptions {
  baseUrl: string;
}

type Listener<T extends unknown[]> = (...args: T) => void;

export class Client {
  private readonly baseUrl: string;

  private readonly listeners = new Map<Events, Set<(...args: any[]) => void>>();

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl;
  }

  on<K extends Events>(event: K, callback: Listener<EventMap[K]>): this {
    let listeners = this.listeners.get(event);

    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }

    listeners.add(callback);

    return this;
  }

  protected emit<K extends Events>(event: K, ...args: EventMap[K]): void {
    const listeners = this.listeners.get(event);

    if (!listeners) return;

    for (const listener of listeners) {
      listener(...args);
    }
  }
}
