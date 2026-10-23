"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var correlator_exports = {};
__export(correlator_exports, {
  Correlator: () => Correlator
});
module.exports = __toCommonJS(correlator_exports);
class Correlator {
  /**
   * @param timers timer functions
   */
  constructor(timers) {
    this.timers = timers;
  }
  pending = /* @__PURE__ */ new Map();
  counter = 0;
  /** @returns number of pending commands */
  get size() {
    return this.pending.size;
  }
  /**
   * Registers a command and returns its id and a promise for the result.
   *
   * @param device device the command goes to
   * @param timeoutMs timeout in ms
   */
  create(device, timeoutMs) {
    this.counter = (this.counter + 1) % 1e6;
    const id = `${Date.now().toString(36)}-${this.counter.toString(36)}`;
    const promise = new Promise((resolve, reject) => {
      const timer = this.timers.set(() => {
        this.pending.delete(id);
        reject(new Error(`timeout after ${Math.round(timeoutMs / 1e3)} s`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, device });
    });
    return { id, promise };
  }
  /**
   * Delivers a result; returns false if no command with this id is pending.
   *
   * @param result parsed result
   */
  resolve(result) {
    const p = this.pending.get(result.id);
    if (!p) {
      return false;
    }
    this.timers.clear(p.timer);
    this.pending.delete(result.id);
    p.resolve(result);
    return true;
  }
  /**
   * Rejects all pending commands (of one device or all).
   *
   * @param reason error text
   * @param device only this device
   */
  rejectAll(reason, device) {
    for (const [id, p] of this.pending) {
      if (device === void 0 || p.device === device) {
        this.timers.clear(p.timer);
        this.pending.delete(id);
        p.reject(new Error(reason));
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Correlator
});
//# sourceMappingURL=correlator.js.map
