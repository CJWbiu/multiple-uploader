import { describe, it, beforeEach, vi, expect } from "vitest";
import { EventEmitter } from "../src/event";

describe("EventEmitter", () => {
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
  });

  it("可以监听、触发事件", () => {
    const eventName = "testEvent";
    const listener = vi.fn();

    eventEmitter.on(eventName, listener);
    eventEmitter.emit(eventName, "arg1", "arg2");

    expect(listener).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("可以取消指定事件的监听", () => {
    const eventName = "testEvent";
    const listener = vi.fn();

    eventEmitter.on(eventName, listener);
    eventEmitter.off(eventName, listener);

    eventEmitter.emit(eventName);

    expect(listener).not.toHaveBeenCalled();
  });

  it("可以取消所有事件的监听", () => {
    const eventName1 = "testEvent1";
    const eventName2 = "testEvent2";
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    eventEmitter.on(eventName1, listener1);
    eventEmitter.on(eventName2, listener2);

    eventEmitter.offAll();
    eventEmitter.emit(eventName1);
    eventEmitter.emit(eventName2);

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it("emit一个不存在的事件不会报错", () => {
    const eventName = "testEvent";
    expect(() => {
      eventEmitter.emit(eventName);
    }).not.toThrow();
  });
});
