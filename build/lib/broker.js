"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var broker_exports = {};
__export(broker_exports, {
  checkLogin: () => checkLogin,
  sameSecret: () => sameSecret,
  startBroker: () => startBroker
});
module.exports = __toCommonJS(broker_exports);
var import_node_crypto = require("node:crypto");
var import_node_net = require("node:net");
function sameSecret(a, b) {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && (0, import_node_crypto.timingSafeEqual)(x, y);
}
function checkLogin(opts, username, password) {
  var _a, _b;
  if (!opts.username) {
    return true;
  }
  return sameSecret(username != null ? username : "", opts.username) && sameSecret((_a = password == null ? void 0 : password.toString("utf8")) != null ? _a : "", (_b = opts.password) != null ? _b : "");
}
async function startBroker(opts) {
  const { Aedes } = await Promise.resolve().then(() => __toESM(require("aedes")));
  const broker = await Aedes.createBroker({
    authenticate: (_client, username, password, done) => {
      const ok = checkLogin(opts, username, password);
      if (ok) {
        done(null, true);
      } else {
        const err = Object.assign(new Error("Bad user name or password"), { returnCode: 4 });
        done(err, false);
      }
    }
  });
  const sockets = /* @__PURE__ */ new Set();
  const server = (0, import_node_net.createServer)((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    broker.handle(socket);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, opts.bind || "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return {
    clients: () => broker.connectedClients,
    close: async () => {
      for (const s of sockets) {
        s.destroy();
      }
      await new Promise((resolve) => server.close(() => resolve()));
      await new Promise((resolve) => broker.close(() => resolve()));
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkLogin,
  sameSecret,
  startBroker
});
//# sourceMappingURL=broker.js.map
