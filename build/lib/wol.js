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
var wol_exports = {};
__export(wol_exports, {
  magicPacket: () => magicPacket,
  normalizeMac: () => normalizeMac,
  sendWol: () => sendWol
});
module.exports = __toCommonJS(wol_exports);
var import_node_dgram = require("node:dgram");
function normalizeMac(mac) {
  const hex = String(mac != null ? mac : "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (hex.length !== 12 || /^0+$/.test(hex)) {
    return null;
  }
  return hex.match(/.{2}/g).join(":");
}
function magicPacket(mac) {
  const norm = normalizeMac(mac);
  if (!norm) {
    throw new Error(`invalid MAC address "${mac}"`);
  }
  const bytes = Buffer.from(norm.replace(/:/g, ""), "hex");
  const packet = Buffer.alloc(6 + 16 * 6, 255);
  for (let i = 0; i < 16; i++) {
    bytes.copy(packet, 6 + i * 6);
  }
  return packet;
}
async function sendWol(mac, addresses) {
  const packet = magicPacket(mac);
  const sock = (0, import_node_dgram.createSocket)("udp4");
  await new Promise((resolve, reject) => {
    sock.once("error", reject);
    sock.bind(0, () => {
      sock.off("error", reject);
      resolve();
    });
  });
  sock.setBroadcast(true);
  const sent = [];
  const errors = [];
  for (const addr of [...new Set(addresses.filter(Boolean))]) {
    for (let i = 0; i < 3; i++) {
      try {
        await new Promise(
          (resolve, reject) => sock.send(packet, 9, addr, (err) => err ? reject(err) : resolve())
        );
        if (!sent.includes(addr)) {
          sent.push(addr);
        }
      } catch (e) {
        errors.push(`${addr}: ${e.message}`);
      }
    }
  }
  sock.close();
  if (!sent.length) {
    throw new Error(`Wake-on-LAN could not be sent (${errors.join(", ")})`);
  }
  return sent;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  magicPacket,
  normalizeMac,
  sendWol
});
//# sourceMappingURL=wol.js.map
