"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_mqtt = __toESM(require("mqtt"));
var import_broker = require("./lib/broker");
var import_correlator = require("./lib/correlator");
var import_protocol = require("./lib/protocol");
const RESULT = "result";
const DIALOG_COMMANDS = ["ask"];
class DesktopControl extends utils.Adapter {
  client;
  base = "winctl";
  correlator;
  /** topicId → device */
  devices = /* @__PURE__ */ new Map();
  /** objId → topicId */
  byObjId = /* @__PURE__ */ new Map();
  /** object ids already created/updated in this run */
  known = /* @__PURE__ */ new Set();
  lastError = "";
  broker;
  /** messages are handled one after another, so a manifest is complete before the states that follow it */
  queue = Promise.resolve();
  constructor(options = {}) {
    super({
      ...options,
      name: "desktop-control"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    await this.setState("info.connection", false, true);
    this.correlator = new import_correlator.Correlator({
      set: (cb, ms) => this.setTimeout(cb, ms),
      clear: (handle) => this.clearTimeout(handle)
    });
    this.base = String(this.config.topicBase || "winctl").replace(/^\/+|\/+$/g, "") || "winctl";
    const cfg = this.config;
    const mode = cfg.brokerMode || (cfg.host ? "external" : "internal");
    if (mode === "internal") {
      const port = Number(cfg.brokerPort) || 1886;
      try {
        this.broker = await (0, import_broker.startBroker)({
          port,
          bind: cfg.brokerBind || "0.0.0.0",
          username: cfg.username,
          password: cfg.password
        });
      } catch (e) {
        this.log.error(
          `Cannot start the built-in MQTT broker on port ${port}: ${e.message} \u2013 is the port used by another program?`
        );
        return;
      }
      this.log.info(`Built-in MQTT broker listens on ${cfg.brokerBind || "0.0.0.0"}:${port}`);
    } else if (!cfg.host) {
      this.log.error("No MQTT broker configured \u2013 please enter the broker host in the adapter settings.");
      return;
    }
    await this.setForeignObjectNotExistsAsync(this.namespace, {
      type: "meta",
      common: { name: "Desktop Control files (screenshots)", type: "meta.user" },
      native: {}
    });
    await this.restoreDevices();
    await this.subscribeStatesAsync("*");
    this.connect();
  }
  /** Reads the devices created in earlier runs (topic id is stored in native) */
  async restoreDevices() {
    var _a;
    const objs = await this.getAdapterObjectsAsync();
    for (const [id, obj] of Object.entries(objs)) {
      const rel = id.slice(this.namespace.length + 1);
      if (obj.type === "device" && rel !== "all" && !rel.includes(".")) {
        const topicId = String(((_a = obj.native) == null ? void 0 : _a.topicId) || rel);
        this.devices.set(topicId, { topicId, objId: rel, online: false });
        this.byObjId.set(rel, topicId);
        await this.setState(`${rel}.online`, false, true);
      }
    }
  }
  connect() {
    const cfg = this.config;
    const local = !!this.broker;
    const tls = !local && cfg.tls;
    const options = {
      host: local ? "127.0.0.1" : cfg.host,
      port: local ? Number(cfg.brokerPort) || 1886 : Number(cfg.port) || (tls ? 8883 : 1883),
      protocol: tls ? "mqtts" : "mqtt",
      username: cfg.username || void 0,
      password: cfg.password || void 0,
      clientId: cfg.clientId || `iobroker_${this.namespace}_${Math.random().toString(16).slice(2, 8)}`,
      rejectUnauthorized: cfg.rejectUnauthorized !== false,
      reconnectPeriod: 5e3,
      connectTimeout: 1e4,
      clean: true
    };
    this.log.info(`Connecting to MQTT broker ${options.protocol}://${options.host}:${options.port}`);
    const client = import_mqtt.default.connect(options);
    this.client = client;
    client.on("connect", () => {
      this.lastError = "";
      this.log.info("Connected to the MQTT broker");
      void this.setState("info.connection", true, true);
      const b = this.base;
      client.subscribe(
        [
          `${b}/+/online`,
          `${b}/+/info`,
          `${b}/+/state/#`,
          `${b}/+/event/#`,
          `${b}/+/result`,
          `${b}/+/screenshot`
        ],
        { qos: 1 },
        (err) => err && this.log.warn(`Subscribe failed: ${err.message}`)
      );
    });
    client.on("close", () => void this.setState("info.connection", false, true));
    client.on("offline", () => void this.setState("info.connection", false, true));
    client.on("error", (err) => {
      if (err.message !== this.lastError) {
        this.lastError = err.message;
        this.log.warn(`MQTT: ${err.message}`);
      }
    });
    client.on("message", (topic, payload) => {
      this.queue = this.queue.then(() => this.handleMessage(topic, payload)).catch((e) => this.log.warn(`Message ${topic}: ${e.message}`));
    });
  }
  /**
   * Creates or updates an object once per run (extendObject keeps user changes like custom settings)
   *
   * @param id object id
   * @param obj object
   */
  async ensureObject(id, obj) {
    if (this.known.has(id)) {
      return;
    }
    await this.extendObjectAsync(id, obj);
    this.known.add(id);
  }
  /**
   * Device for an agent id (creates the base objects on first contact)
   *
   * @param topicId agent id
   */
  async ensureDevice(topicId) {
    let dev = this.devices.get(topicId);
    if (!dev) {
      let objId = (0, import_protocol.sanitizeSegment)(topicId);
      while (this.byObjId.has(objId) && this.byObjId.get(objId) !== topicId) {
        objId += "_";
      }
      dev = { topicId, objId, online: false };
      this.devices.set(topicId, dev);
      this.byObjId.set(objId, topicId);
    }
    const o = dev.objId;
    await this.ensureObject(o, { type: "device", common: { name: topicId }, native: { topicId } });
    await this.ensureObject(`${o}.online`, {
      type: "state",
      common: { name: "Online", type: "boolean", role: "indicator.reachable", read: true, write: false },
      native: {}
    });
    for (const [ch, name] of [
      ["info", "Information"],
      ["state", "States"],
      ["cmd", "Commands"],
      ["event", "Events"]
    ]) {
      await this.ensureObject(`${o}.${ch}`, { type: "channel", common: { name }, native: {} });
    }
    await this.ensureObject(`${o}.cmd.${RESULT}`, {
      type: "state",
      common: { name: "Last command result", type: "string", role: "json", read: true, write: false },
      native: {}
    });
    await this.ensureObject(`${o}.lastSeen`, {
      type: "state",
      common: {
        name: "Last message from the agent",
        type: "number",
        role: "value.time",
        read: true,
        write: false
      },
      native: {}
    });
    return dev;
  }
  /**
   * @param topic MQTT topic
   * @param payload raw payload
   */
  async handleMessage(topic, payload) {
    const parsed = (0, import_protocol.parseTopic)(this.base, topic);
    if (!parsed) {
      return;
    }
    const dev = await this.ensureDevice(parsed.device);
    const o = dev.objId;
    const body = payload.toString("utf8");
    if (parsed.kind !== "online" || (0, import_protocol.parseOnline)(body)) {
      await this.setStateChangedAsync(`${o}.lastSeen`, Date.now(), true);
    }
    switch (parsed.kind) {
      case "online": {
        dev.online = (0, import_protocol.parseOnline)(body);
        await this.setState(`${o}.online`, dev.online, true);
        if (!dev.online) {
          this.correlator.rejectAll("device offline", dev.topicId);
        }
        break;
      }
      case "info": {
        let raw;
        try {
          raw = JSON.parse(body);
        } catch {
          this.log.warn(`${dev.topicId}: invalid info manifest`);
          return;
        }
        dev.manifest = (0, import_protocol.normalizeManifest)(raw);
        await this.applyManifest(dev);
        break;
      }
      case "state": {
        const def = (0, import_protocol.findStateDef)(dev.manifest, parsed.path);
        const value = (0, import_protocol.parseValue)(body, def == null ? void 0 : def.type);
        const id = `${o}.state.${(0, import_protocol.pathToId)(parsed.path)}`;
        await this.ensureObject(id, {
          type: "state",
          common: (0, import_protocol.stateCommon)(parsed.path, def, value),
          native: {}
        });
        await this.setState(id, value, true);
        break;
      }
      case "event": {
        const id = `${o}.event.${(0, import_protocol.pathToId)(parsed.path)}`;
        await this.ensureObject(id, {
          type: "state",
          common: { name: `Event ${parsed.path}`, type: "string", role: "json", read: true, write: false },
          native: {}
        });
        await this.setState(id, body, true);
        break;
      }
      case "result": {
        const result = (0, import_protocol.parseResult)(body);
        if (result) {
          this.correlator.resolve(result);
          await this.setState(`${o}.cmd.${RESULT}`, JSON.stringify(result), true);
        }
        break;
      }
      case "screenshot": {
        const img = (0, import_protocol.parseScreenshot)(payload);
        if (!img) {
          this.log.warn(`${dev.topicId}: screenshot in unknown format`);
          return;
        }
        const file = `screenshots/${o}.${img.ext}`;
        await this.writeFileAsync(this.namespace, file, img.data);
        const id = `${o}.screenshot`;
        await this.ensureObject(id, {
          type: "state",
          common: {
            name: "Last screenshot (file)",
            type: "string",
            role: "text.url",
            read: true,
            write: false
          },
          native: {}
        });
        await this.setState(id, `/${this.namespace}/${file}`, true);
        if (img.id) {
          this.correlator.resolve({
            id: img.id,
            command: "screenshot",
            ok: true,
            result: `/${this.namespace}/${file}`
          });
        }
        break;
      }
    }
  }
  /**
   * Creates info, state and command objects from the manifest
   *
   * @param dev device
   */
  async applyManifest(dev) {
    const m = dev.manifest;
    if (!m) {
      return;
    }
    const o = dev.objId;
    await this.extendObjectAsync(o, { common: { name: m.hostname || dev.topicId } });
    const infos = [
      ["hostname", "Host name", "info.name"],
      ["ip", "IP address", "info.ip"],
      ["version", "Agent version", "info.firmware"],
      ["os", "Operating system", "text"],
      ["user", "Logged-in user", "text"],
      ["started", "Agent started", "date"]
    ];
    for (const [key, name, role] of infos) {
      await this.ensureObject(`${o}.info.${key}`, {
        type: "state",
        common: { name, type: "string", role, read: true, write: false },
        native: {}
      });
      await this.setStateChangedAsync(`${o}.info.${key}`, m[key], true);
    }
    await this.ensureObject(`${o}.info.apps`, {
      type: "state",
      common: {
        name: "Allowed programs (aliases for run/open)",
        type: "string",
        role: "json",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setStateChangedAsync(`${o}.info.apps`, JSON.stringify(m.apps), true);
    if (m.protocol > 1) {
      this.log.warn(
        `${dev.topicId}: agent uses protocol ${m.protocol}, this adapter knows protocol 1 \u2013 please update the adapter`
      );
    }
    for (const s of m.states.filter((st) => !st.pattern)) {
      const id = `${o}.state.${(0, import_protocol.pathToId)(s.path)}`;
      this.known.delete(id);
      await this.ensureObject(id, { type: "state", common: (0, import_protocol.stateCommon)(s.path, s), native: {} });
    }
    const wanted = /* @__PURE__ */ new Set([`${o}.cmd.${RESULT}`]);
    for (const c of m.commands) {
      const kind = (0, import_protocol.commandKind)(c);
      if (kind === "none") {
        continue;
      }
      const id = `${o}.cmd.${(0, import_protocol.sanitizeSegment)(c.name)}`;
      if (id === `${o}.cmd.${RESULT}`) {
        continue;
      }
      wanted.add(id);
      this.known.delete(id);
      await this.ensureObject(id, {
        type: "state",
        common: this.commandCommon(c, kind, m.apps),
        native: { command: c.name }
      });
    }
    const existing = await this.getObjectViewAsync("system", "state", {
      startkey: `${this.namespace}.${o}.cmd.`,
      endkey: `${this.namespace}.${o}.cmd.\u9999`
    });
    for (const row of existing.rows) {
      const rel = row.id.slice(this.namespace.length + 1);
      if (!wanted.has(rel)) {
        await this.delObjectAsync(rel);
        this.known.delete(rel);
      }
    }
    await this.updateBroadcastCommands();
    this.log.info(
      `${dev.topicId}: ${m.hostname || "?"} (agent ${m.version || "?"}), ${m.states.length} states, ${m.commands.length} commands`
    );
  }
  /**
   * common of a command data point
   *
   * @param c command
   * @param kind button or json
   * @param apps aliases of the agent (selection list for run)
   */
  commandCommon(c, kind, apps) {
    const desc = c.description || (c.params.length ? `Parameters: ${c.params.map((p) => `${p.name}${p.required ? "*" : ""}`).join(", ")}` : "");
    return kind === "button" ? { name: c.name, desc, type: "boolean", role: "button", read: false, write: true } : {
      name: c.name,
      desc,
      type: "string",
      role: "json",
      read: true,
      write: true,
      def: "{}",
      // run: the aliases of the agent as a selection list (short form)
      ...c.name === "run" && (apps == null ? void 0 : apps.length) ? { states: Object.fromEntries(apps.map((a) => [a, a])) } : {}
    };
  }
  /** all.cmd.*: commands every device can do the same way (union of the non-dangerous commands) */
  async updateBroadcastCommands() {
    var _a, _b;
    const cmds = /* @__PURE__ */ new Map();
    for (const d of this.devices.values()) {
      for (const c of (_b = (_a = d.manifest) == null ? void 0 : _a.commands) != null ? _b : []) {
        if ((0, import_protocol.commandKind)(c) !== "none" && !cmds.has(c.name)) {
          cmds.set(c.name, c);
        }
      }
    }
    if (!cmds.size) {
      return;
    }
    await this.ensureObject("all", { type: "device", common: { name: "All PCs (broadcast)" }, native: {} });
    await this.ensureObject("all.cmd", { type: "channel", common: { name: "Commands to all PCs" }, native: {} });
    for (const c of cmds.values()) {
      const kind = (0, import_protocol.commandKind)(c);
      await this.ensureObject(`all.cmd.${(0, import_protocol.sanitizeSegment)(c.name)}`, {
        type: "state",
        common: this.commandCommon(c, kind),
        native: { command: c.name }
      });
    }
  }
  /**
   * Sends a command to one agent and waits for its result.
   *
   * @param topicId agent id
   * @param command command name
   * @param params parameters
   * @param timeoutMs timeout (default from the settings)
   */
  async sendCommand(topicId, command, params, timeoutMs) {
    var _a;
    const dev = this.devices.get(topicId);
    if (!dev) {
      throw new Error(`unknown device "${topicId}"`);
    }
    if (!dev.online) {
      throw new Error(`device "${topicId}" is offline`);
    }
    if (!((_a = this.client) == null ? void 0 : _a.connected)) {
      throw new Error("not connected to the MQTT broker");
    }
    const defaultS = DIALOG_COMMANDS.includes(command) ? this.config.askTimeout || 120 : this.config.cmdTimeout || 10;
    const { id, promise } = this.correlator.create(topicId, timeoutMs != null ? timeoutMs : defaultS * 1e3);
    await this.client.publishAsync(`${this.base}/${topicId}/cmd/${command}`, JSON.stringify({ ...params, id }), {
      qos: 1
    });
    return promise;
  }
  /**
   * Sends a command to all agents (no result)
   *
   * @param command command name
   * @param params parameters
   */
  async broadcast(command, params) {
    var _a;
    if (!((_a = this.client) == null ? void 0 : _a.connected)) {
      throw new Error("not connected to the MQTT broker");
    }
    await this.client.publishAsync(`${this.base}/all/cmd/${command}`, JSON.stringify(params), { qos: 1 });
  }
  /**
   * Commands and writable states from ioBroker (ack=false only)
   *
   * @param id state id
   * @param state state
   */
  async onStateChange(id, state) {
    var _a;
    if (!state || state.ack) {
      return;
    }
    const rel = id.slice(this.namespace.length + 1);
    const parts = rel.split(".");
    try {
      if (parts[1] === "cmd" && parts.length === 3 && parts[2] !== RESULT) {
        const obj = await this.getObjectAsync(rel);
        const command = String(((_a = obj == null ? void 0 : obj.native) == null ? void 0 : _a.command) || parts[2]);
        const def = [...this.devices.values()].filter((d) => parts[0] === "all" || d.objId === parts[0]).map((d) => {
          var _a2;
          return (_a2 = d.manifest) == null ? void 0 : _a2.commands.find((c) => c.name === command);
        }).find((c) => c);
        const params = (0, import_protocol.parseCommandParams)(state.val, def);
        if (typeof params === "string") {
          throw new Error(params);
        }
        if (parts[0] === "all") {
          await this.broadcast(command, params);
          await this.setState(rel, state.val, true);
          return;
        }
        const topicId = this.byObjId.get(parts[0]);
        if (!topicId) {
          throw new Error("unknown device");
        }
        await this.setState(rel, state.val, true);
        const result = await this.sendCommand(topicId, command, params);
        if (!result.ok) {
          this.log.warn(`${topicId}: ${command} failed: ${result.error || "unknown error"}`);
        }
        return;
      }
      if (parts[1] === "state" && parts.length >= 3) {
        const topicId = this.byObjId.get(parts[0]);
        const dev = topicId ? this.devices.get(topicId) : void 0;
        if (!dev) {
          return;
        }
        const path = parts.slice(2).join("/");
        const cmd = (0, import_protocol.commandForStateWrite)(dev.manifest, path, state.val);
        if (!cmd) {
          this.log.warn(`${rel} is not writable`);
          return;
        }
        const result = await this.sendCommand(dev.topicId, cmd.command, cmd.params);
        if (!result.ok) {
          this.log.warn(`${dev.topicId}: ${cmd.command} failed: ${result.error || "unknown error"}`);
        }
      }
    } catch (e) {
      this.log.warn(`${rel}: ${e.message}`);
    }
  }
  /**
   * sendTo interface:
   * - "cmd" { device, command, params?, timeout? } → result of the agent (device "all" = broadcast)
   * - "devices" → list of known devices
   *
   * @param obj message
   */
  async onMessage(obj) {
    var _a;
    if (!(obj == null ? void 0 : obj.callback)) {
      return;
    }
    const reply = (response) => {
      this.sendTo(obj.from, obj.command, response, obj.callback);
    };
    const msg = (_a = obj.message) != null ? _a : {};
    if (obj.command === "devices") {
      reply(
        [...this.devices.values()].map((d) => {
          var _a2, _b, _c, _d;
          return {
            device: d.topicId,
            objId: d.objId,
            hostname: (_b = (_a2 = d.manifest) == null ? void 0 : _a2.hostname) != null ? _b : "",
            online: d.online,
            commands: (_d = (_c = d.manifest) == null ? void 0 : _c.commands.map((c) => c.name)) != null ? _d : []
          };
        })
      );
      return;
    }
    if (obj.command !== "cmd") {
      reply({ ok: false, error: `unknown command "${obj.command}"` });
      return;
    }
    const device = (0, import_protocol.text)(msg.device);
    const command = (0, import_protocol.text)(msg.command);
    if (!device || !command) {
      reply({ ok: false, error: "device and command are required" });
      return;
    }
    const paramsFor = (topicId) => {
      if (msg.params && typeof msg.params === "object" && !Array.isArray(msg.params)) {
        return msg.params;
      }
      if (msg.params === void 0 || msg.params === null) {
        return {};
      }
      const def = [...this.devices.values()].filter((d) => !topicId || d.topicId === topicId).map((d) => {
        var _a2;
        return (_a2 = d.manifest) == null ? void 0 : _a2.commands.find((c) => c.name === command);
      }).find((c) => c);
      const p = (0, import_protocol.parseCommandParams)(msg.params, def);
      if (typeof p === "string") {
        throw new Error(p);
      }
      return p;
    };
    try {
      if (device === "all") {
        const params2 = paramsFor();
        await this.broadcast(command, params2);
        reply({ ok: true, broadcast: true });
        return;
      }
      const topicId = this.resolveDevice(device);
      const params = paramsFor(topicId);
      const timeout = typeof msg.timeout === "number" && msg.timeout > 0 ? msg.timeout : void 0;
      const result = await this.sendCommand(topicId, command, params, timeout);
      reply(result);
    } catch (e) {
      reply({ ok: false, command, error: e.message });
    }
  }
  /**
   * Device by agent id, object id or host name
   *
   * @param name device name as given in sendTo
   */
  resolveDevice(name) {
    var _a;
    if (this.devices.has(name)) {
      return name;
    }
    const byObj = this.byObjId.get(name);
    if (byObj) {
      return byObj;
    }
    for (const d of this.devices.values()) {
      if (((_a = d.manifest) == null ? void 0 : _a.hostname) && d.manifest.hostname.toLowerCase() === name.toLowerCase()) {
        return d.topicId;
      }
    }
    throw new Error(`unknown device "${name}"`);
  }
  onUnload(callback) {
    var _a, _b, _c;
    try {
      (_a = this.correlator) == null ? void 0 : _a.rejectAll("adapter stopped");
      (_b = this.client) == null ? void 0 : _b.end(true);
      void ((_c = this.broker) == null ? void 0 : _c.close());
      void this.setState("info.connection", false, true);
      callback();
    } catch {
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new DesktopControl(options);
} else {
  (() => new DesktopControl())();
}
//# sourceMappingURL=main.js.map
