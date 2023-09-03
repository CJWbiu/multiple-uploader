import logger from "./logger";

type Listener = (...args: any[]) => void;

export class EventEmitter {
  private events: Record<string, Listener[]> = {};

  on(eventName: string, listener: Listener) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(listener);
  }

  emit(eventName: string, ...args: any[]) {
    const listeners = this.events[eventName];
    if (listeners) {
      for (const listener of listeners) {
        listener(...args);
      }
      return;
    }

    logger.warn(`The event '${eventName}' is not registered`);
  }

  // 删除事件
  off(eventName: string, listener: Listener) {
    const listeners = this.events[eventName];
    if (listeners) {
      this.events[eventName] = listeners.filter((l) => l !== listener);
      return;
    }

    logger.warn(`The event '${eventName}' is not registered`);
  }

  offAll() {
    this.events = {};
  }
}
