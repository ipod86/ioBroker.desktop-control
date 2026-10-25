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
  ALIAS_LIMITED: () => ALIAS_LIMITED,
  OPTIONS_SUFFIX: () => OPTIONS_SUFFIX,
  WRITABLE_COMMANDS: () => WRITABLE_COMMANDS,
  commandDataPoints: () => commandDataPoints,
  commandForStateWrite: () => commandForStateWrite,
  commandKind: () => commandKind,
  convertParam: () => convertParam,
  findStateDef: () => findStateDef,
  fitRole: () => fitRole,
  normalizeManifest: () => normalizeManifest,
  parseCommandParams: () => parseCommandParams,
  parseOnline: () => parseOnline,
  parseResult: () => parseResult,
  parseScreenshot: () => parseScreenshot,
  parseTopic: () => parseTopic,
  parseValue: () => parseValue,
  pathToId: () => pathToId,
  sanitizeSegment: () => sanitizeSegment,
  stateCommon: () => stateCommon,
  text: () => text
});
module.exports = __toCommonJS(protocol_exports);
var import_roles = require("./roles");
function text(v) {
  if (v === void 0 || v === null) {
    return "";
  }
  if (typeof v === "object") {
    return JSON.stringify(v);
  }
  if (typeof v === "string") {
    return v;
  }
  return typeof v === "number" || typeof v === "boolean" || typeof v === "bigint" ? v.toString() : "";
}
const KINDS = ["online", "info", "state", "event", "result", "screenshot"];
const FORBIDDEN = /[^A-Za-z0-9_-]+/g;
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
  return segment.replace(FORBIDDEN, "_") || "_";
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
const WRITABLE_COMMANDS = {
  volume: { command: "volume", param: "level" },
  muted: { command: "mute", param: "state" },
  keep_awake: { command: "keep_awake", param: "state" }
};
const TYPES = ["number", "string", "boolean", "json", "array", "object", "mixed"];
const ALIAS_LIMITED = ["run", "kill"];
function normalizeManifest(raw) {
  const m = raw && typeof raw === "object" ? raw : {};
  const str = text;
  const states = entries(m.states).map(([path, e]) => {
    const raw2 = TYPES.includes(str(e.type)) ? str(e.type) : "mixed";
    let pattern;
    if (path.includes("<") || path.endsWith("/*")) {
      const re = path.split(/(<[^>]+>|\*)/).map(
        (part) => part.startsWith("<") || part === "*" ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      ).join("");
      pattern = new RegExp(`^${re}$`);
    }
    const type = ["json", "array", "object"].includes(raw2) ? "string" : raw2;
    const writable = e.writable === true || path in WRITABLE_COMMANDS;
    const role = fitRole(str(e.role), raw2, writable);
    return {
      path,
      type,
      // only official ioBroker roles; anything else falls back to a generic role of the type
      role,
      name: str(e.name) || path,
      description: str(e.description),
      unit: e.unit !== void 0 && e.unit !== "" ? str(e.unit) : void 0,
      min: typeof e.min === "number" ? e.min : void 0,
      max: typeof e.max === "number" ? e.max : void 0,
      writable,
      pattern
    };
  });
  const security = m.security && typeof m.security === "object" ? m.security : {};
  const disabled = Array.isArray(security.disabled_commands) ? security.disabled_commands.map(str) : [];
  const commands = entries(m.commands).map(([name, e]) => ({
    name,
    params: entries(e.params).map(([pn, p]) => ({
      name: pn,
      type: str(p.type) || "string",
      required: p.required === true,
      enum: Array.isArray(p.enum) ? p.enum.map(str) : void 0,
      default: p.default
    })),
    // run/kill are only flagged because of AllowAnyRun; with alias-only run the agent itself limits them
    dangerous: e.dangerous === true && !(ALIAS_LIMITED.includes(name) && security.allow_any_run === false),
    needsGui: e.needs_gui === true || e.needsGui === true,
    description: str(e.description),
    primary: e.primary ? str(e.primary) : void 0,
    examples: Array.isArray(e.examples) ? e.examples.map(str) : [],
    disabled: disabled.includes(name)
  }));
  const events = Array.isArray(m.events) ? m.events.map(str).filter(Boolean) : entries(m.events).map(([n]) => n);
  return {
    hostname: str(m.hostname),
    ip: str(m.ip),
    version: str(m.version),
    os: str(m.os),
    user: str(m.user),
    deviceId: str(m.device_id),
    started: str(m.started),
    protocol: typeof m.protocol === "number" ? m.protocol : 0,
    apps: Array.isArray(security.apps) ? security.apps.map(str) : [],
    mac: str(m.mac),
    broadcast: str(m.broadcast),
    allowAnyRun: security.allow_any_run === true,
    states,
    commands,
    events
  };
}
function fitRole(role, type, writable) {
  if (!(0, import_roles.isOfficialRole)(role)) {
    return defaultRole(type, writable);
  }
  const family = role.split(".")[0];
  const booleanFamily = ["indicator", "sensor", "switch", "button"].includes(family);
  if (booleanFamily !== (type === "boolean") && family !== "level" && family !== "value") {
    return defaultRole(type, writable);
  }
  if (family === "button") {
    return writable ? role : "indicator";
  }
  if (writable) {
    if (family === "indicator" || family === "sensor") {
      return "switch";
    }
    if (family === "value") {
      const level = `level${role.slice("value".length)}`;
      return (0, import_roles.isOfficialRole)(level) ? level : defaultRole(type, writable);
    }
  } else {
    if (family === "switch") {
      return "indicator";
    }
    if (family === "level") {
      const value = `value${role.slice("level".length)}`;
      return (0, import_roles.isOfficialRole)(value) ? value : defaultRole(type, writable);
    }
  }
  if ((family === "level" || family === "value") && type !== "number") {
    return defaultRole(type, writable);
  }
  return role;
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
  return manifest.states.find((s) => !s.pattern && s.path === path) || manifest.states.find((s) => {
    var _a;
    return (_a = s.pattern) == null ? void 0 : _a.test(path);
  });
}
function stateCommon(path, def, value) {
  if (def) {
    const common = {
      name: def.pattern ? path : def.name,
      type: def.type,
      role: def.role,
      // buttons are write-only (stateroles.md)
      read: def.role !== "button" && !def.role.startsWith("button."),
      write: def.writable
    };
    if (def.unit) {
      common.unit = def.unit;
    }
    if (def.description) {
      common.desc = def.description;
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
function convertParam(value, type) {
  switch (type) {
    case "integer":
      return Math.round(Number(value));
    case "number":
      return Number(value);
    case "boolean":
      return typeof value === "string" ? ["true", "1", "on", "yes"].includes(value.toLowerCase()) : !!value;
    case "string":
      return text(value);
    default:
      return value;
  }
}
function commandForStateWrite(manifest, path, value) {
  var _a, _b;
  const map = WRITABLE_COMMANDS[path];
  if (!map) {
    return null;
  }
  const cmd = manifest == null ? void 0 : manifest.commands.find((c) => c.name === map.command);
  const param = (cmd == null ? void 0 : cmd.primary) || ((_a = cmd == null ? void 0 : cmd.params[0]) == null ? void 0 : _a.name) || map.param;
  const type = (_b = cmd == null ? void 0 : cmd.params.find((p) => p.name === param)) == null ? void 0 : _b.type;
  return { command: map.command, params: { [param]: convertParam(value, type) } };
}
function commandKind(cmd) {
  if (cmd.dangerous || cmd.disabled) {
    return "none";
  }
  if (!cmd.params.length) {
    return "button";
  }
  const primary = cmd.params.find((p) => p.name === cmd.primary);
  if (cmd.params.some((p) => p.required) || primary && primary.default === void 0) {
    return "json";
  }
  return "both";
}
const OPTIONS_SUFFIX = "_json";
function commandDataPoints(cmd) {
  const kind = commandKind(cmd);
  if (kind === "none") {
    return [];
  }
  if (kind === "both") {
    return [
      { suffix: "", kind: "button" },
      { suffix: OPTIONS_SUFFIX, kind: "json" }
    ];
  }
  return [{ suffix: "", kind }];
}
function parseCommandParams(value, cmd) {
  var _a;
  if (value === null || value === void 0 || value === "" || value === true) {
    return {};
  }
  if (typeof value === "string") {
    try {
      const p = JSON.parse(value);
      if (p && typeof p === "object" && !Array.isArray(p)) {
        return p;
      }
    } catch {
    }
  }
  const primaryType = (cmd == null ? void 0 : cmd.primary) ? (_a = cmd.params.find((p) => p.name === cmd.primary)) == null ? void 0 : _a.type : void 0;
  if (value === "{}" || value === "true" && primaryType !== "boolean") {
    return {};
  }
  if (cmd == null ? void 0 : cmd.primary) {
    return { [cmd.primary]: convertParam(value, primaryType) };
  }
  return "parameters must be a JSON object";
}
function parseResult(payload) {
  var _a;
  try {
    const r = JSON.parse(payload);
    if (!r || typeof r !== "object") {
      return null;
    }
    const error = r.error === void 0 || r.error === null ? void 0 : text(r.error);
    return {
      id: text(r.id),
      command: text((_a = r.cmd) != null ? _a : r.command),
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
      id = text(j.id);
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
  ALIAS_LIMITED,
  OPTIONS_SUFFIX,
  WRITABLE_COMMANDS,
  commandDataPoints,
  commandForStateWrite,
  commandKind,
  convertParam,
  findStateDef,
  fitRole,
  normalizeManifest,
  parseCommandParams,
  parseOnline,
  parseResult,
  parseScreenshot,
  parseTopic,
  parseValue,
  pathToId,
  sanitizeSegment,
  stateCommon,
  text
});
//# sourceMappingURL=protocol.js.map
