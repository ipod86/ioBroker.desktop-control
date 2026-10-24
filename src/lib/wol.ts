/**
 * Wake-on-LAN: the "magic packet" (6 × 0xFF followed by 16 × the MAC address) sent as UDP broadcast.
 */

import { createSocket } from 'node:dgram';

/**
 * Normalises a MAC address to "AA:BB:CC:DD:EE:FF"
 *
 * @param mac MAC address with ":", "-" or without separators
 * @returns normalised address or null if invalid
 */
export function normalizeMac(mac: string | undefined): string | null {
	const hex = String(mac ?? '')
		.replace(/[^0-9a-fA-F]/g, '')
		.toUpperCase();
	if (hex.length !== 12 || /^0+$/.test(hex)) {
		return null;
	}
	return hex.match(/.{2}/g)!.join(':');
}

/**
 * Builds the magic packet
 *
 * @param mac MAC address
 */
export function magicPacket(mac: string): Buffer {
	const norm = normalizeMac(mac);
	if (!norm) {
		throw new Error(`invalid MAC address "${mac}"`);
	}
	const bytes = Buffer.from(norm.replace(/:/g, ''), 'hex');
	const packet = Buffer.alloc(6 + 16 * 6, 0xff);
	for (let i = 0; i < 16; i++) {
		bytes.copy(packet, 6 + i * 6);
	}
	return packet;
}

/**
 * Sends the magic packet to every address (UDP port 9); fails only if no address could be reached
 *
 * @param mac MAC address
 * @param addresses broadcast addresses, e.g. the subnet broadcast of the PC and 255.255.255.255
 */
export async function sendWol(mac: string, addresses: string[]): Promise<string[]> {
	const packet = magicPacket(mac);
	const sock = createSocket('udp4');
	await new Promise<void>((resolve, reject) => {
		sock.once('error', reject);
		sock.bind(0, () => {
			sock.off('error', reject);
			resolve();
		});
	});
	sock.setBroadcast(true);
	const sent: string[] = [];
	const errors: string[] = [];
	for (const addr of [...new Set(addresses.filter(Boolean))]) {
		// three times, a single UDP packet can get lost
		for (let i = 0; i < 3; i++) {
			try {
				await new Promise<void>((resolve, reject) =>
					sock.send(packet, 9, addr, err => (err ? reject(err) : resolve())),
				);
				if (!sent.includes(addr)) {
					sent.push(addr);
				}
			} catch (e) {
				errors.push(`${addr}: ${(e as Error).message}`);
			}
		}
	}
	sock.close();
	if (!sent.length) {
		throw new Error(`Wake-on-LAN could not be sent (${errors.join(', ')})`);
	}
	return sent;
}
