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
var protocol_exports = {};
__export(protocol_exports, {
  WRITABLE_COMMANDS: () => WRITABLE_COMMANDS,
  commandForStateWrite: () => commandForStateWrite,
  commandKind: () => commandKind,
  findStateDef: () => findStateDef,
  normalizeManifest: () => normalizeManifest,
  parseCommandParams: () => parseCommandParams,
  parseOnline: () => parseOnline,
  parseResult: () => parseResult,
  parseScreenshot: () => parseScreenshot,
  parseTopic: () => parseTopic,
  parseValue: () => parseValue,
  pathToId: () => pathToId,
  sanitizeSegment: () => sanitizeSegment,
  stateCommon: () => stateCommon
});
module.exports = __toCommonJS(protocol_exports);
const KINDS = ["online", "info", "state", "event", "result", "screenshot"];
const FORBIDDEN = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;
function parseTopic(base, topic) {
  const prefix = `${base}/`;
  if (!topic.startsWith(prefix)) {
    return null;
  }
  const parts = topic.slice(prefix.length).split("/");
  if (parts.length < 2 || !parts[0] || parts[0] === "all") {
    return null;
  }
  const kind = parts[1];
  if (!KINDS.includes(kind)) {
    return null;
  }
  const path = parts.slice(2).join("/");
  if ((kind === "state" || kind === "event") && !path) {
    return null;
  }
  if (kind !== "state" && kind !== "event" && path) {
    return null;
  }
  return { device: parts[0], kind, path };
}
function sanitizeSegment(segment) {
  return segment.replace(FORBIDDEN, "_").replace(/[.\s]/g, "_") || "_";
}
function pathToId(path) {
  return path.split("/").filter((s) => s !== "").map(sanitizeSegment).join(".");
}
function parseValue(payload, type) {
  let v = payload;
  try {
    v = JSON.parse(payload);
  } catch {
  }
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "boolean") {
    if (typeof v === "string") {
      return ["true", "1", "on", "yes"].includes(v.toLowerCase());
    }
    return !!v;
  }
  if (type === "string") {
    return typeof v === "string" ? v : JSON.stringify(v);
  }
  if (v === null || typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
    return v;
  }
  return JSON.stringify(v);
}
function parseOnline(payload) {
  const p = payload.trim().toLowerCase().replace(/^"|"$/g, "");
  return ["true", "1", "online", "on", "yes"].includes(p);
}
function entries(input) {
  if (Array.isArray(input)) {
    return input.filter((e) => e && typeof e === "object" && typeof e.name === "string").map((e) => [e.name, e]);
  }
  if (input && typeof input === "object") {
    return Object.entries(input).map(([k, e]) => [
      k,
      e && typeof e === "object" ? e : {}
    ]);
  }
  return [];
}
const TYPES = ["number", "string", "boolean", "json", "array", "object", "mixed"];
function normalizeManifest(raw) {
  const m = raw && typeof raw === "object" ? raw : {};
  const str = (v) => v === void 0 || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  const states = entries(m.states).map(([path, e]) => {
    const raw2 = TYPES.includes(str(e.type)) ? str(e.type) : "mixed";
    const template = path.endsWith("/*");
    const type = ["json", "array", "object"].includes(raw2) ? "string" : raw2;
    return {
      path: template ? path.slice(0, -2) : path,
      type,
      role: str(e.role) || defaultRole(raw2, !!e.writable),
      name: str(e.name) || path,
      unit: e.unit !== void 0 ? str(e.unit) : void 0,
      min: typeof e.min === "number" ? e.min : void 0,
      max: typeof e.max === "number" ? e.max : void 0,
      writable: e.writable === true,
      template
    };
  });
  const commands = entries(m.commands).map(([name, e]) => ({
    name,
    params: entries(e.params).map(([pn, p]) => ({
      name: pn,
      type: str(p.type) || "string",
      required: p.required === true
    })),
    dangerous: e.dangerous === true,
    needsGui: e.needs_gui === true || e.needsGui === true,
    description: str(e.description)
  }));
  const events = Array.isArray(m.events) ? m.events.map(str).filter(Boolean) : entries(m.events).map(([n]) => n);
  return {
    hostname: str(m.hostname),
    ip: str(m.ip),
    version: str(m.version),
    os: str(m.os),
    user: str(m.user),
    states,
    commands,
    events
  };
}
function defaultRole(type, writable) {
  if (type === "boolean") {
    return writable ? "switch" : "indicator";
  }
  if (type === "number") {
    return writable ? "level" : "value";
  }
  if (type === "json" || type === "array" || type === "object") {
    return "json";
  }
  return "text";
}
function findStateDef(manifest, path) {
  if (!manifest) {
    return void 0;
  }
  return manifest.states.find((s) => !s.template && s.path === path) || manifest.states.find((s) => s.template && path.startsWith(`${s.path}/`));
}
function stateCommon(path, def, value) {
  if (def) {
    const common = {
      name: def.template ? `${def.name} ${path.slice(def.path.length + 1)}` : def.name,
      type: def.type,
      role: def.role,
      read: true,
      write: def.writable
    };
    if (def.unit) {
      common.unit = def.unit;
    }
    if (def.min !== void 0) {
      common.min = def.min;
    }
    if (def.max !== void 0) {
      common.max = def.max;
    }
    return common;
  }
  const type = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
  return { name: path, type, role: defaultRole(type, false), read: true, write: false };
}
const WRITABLE_COMMANDS = {
  volume: { command: "volume", param: "level" },
  muted: { command: "mute", param: "mute" },
  keep_awake: { command: "keep_awake", param: "enable" }
};
function commandForStateWrite(manifest, path, value) {
  var _a;
  const map = WRITABLE_COMMANDS[path];
  if (!map) {
    return null;
  }
  const cmd = manifest == null ? void 0 : manifest.commands.find((c) => c.name === map.command);
  const param = ((_a = cmd == null ? void 0 : cmd.params[0]) == null ? void 0 : _a.name) || map.param;
  return { command: map.command, params: { [param]: value } };
}
function commandKind(cmd) {
  if (cmd.dangerous) {
    return "none";
  }
  return cmd.params.some((p) => p.required) ? "json" : "button";
}
function parseCommandParams(value) {
  if (value === null || value === void 0 || value === "" || value === true) {
    return {};
  }
  if (typeof value !== "string") {
    return "parameters must be a JSON object";
  }
  try {
    const p = JSON.parse(value);
    if (p && typeof p === "object" && !Array.isArray(p)) {
      return p;
    }
  } catch {
  }
  return "parameters must be a JSON object";
}
function parseResult(payload) {
  try {
    const r = JSON.parse(payload);
    if (!r || typeof r !== "object") {
      return null;
    }
    const error = r.error === void 0 || r.error === null ? void 0 : String(r.error);
    return {
      id: r.id === void 0 || r.id === null ? "" : String(r.id),
      command: r.command === void 0 ? "" : String(r.command),
      ok: r.ok === void 0 ? !error : r.ok === true,
      result: r.result !== void 0 ? r.result : r.data,
      error
    };
  } catch {
    return null;
  }
}
function parseScreenshot(payload) {
  if (payload.length === 0) {
    return null;
  }
  let data = payload;
  let id = "";
  if (payload[0] === 123) {
    try {
      const j = JSON.parse(payload.toString("utf8"));
      if (typeof j.data !== "string") {
        return null;
      }
      data = Buffer.from(j.data, "base64");
      id = j.id === void 0 ? "" : String(j.id);
    } catch {
      return null;
    }
  }
  if (data[0] === 137 && data[1] === 80) {
    return { data, ext: "png", id };
  }
  if (data[0] === 255 && data[1] === 216) {
    return { data, ext: "jpg", id };
  }
  return null;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WRITABLE_COMMANDS,
  commandForStateWrite,
  commandKind,
  findStateDef,
  normalizeManifest,
  parseCommandParams,
  parseOnline,
  parseResult,
  parseScreenshot,
  parseTopic,
  parseValue,
  pathToId,
  sanitizeSegment,
  stateCommon
});
//# sourceMappingURL=protocol.js.map
