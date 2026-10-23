/**
 * Built-in MQTT broker (aedes), so the agents need no extra broker software.
 * The adapter itself connects to it like any other client.
 */

import { timingSafeEqual } from 'node:crypto';
import { createServer, type Server, type Socket } from 'node:net';

/** Options of the built-in broker */
export interface BrokerOptions {
	/** TCP port */
	port: number;
	/** address to listen on ('0.0.0.0' = all interfaces) */
	bind: string;
	/** when set, every client has to log in with these credentials */
	username?: string;
	/** password for username */
	password?: string;
}

/** Running broker */
export interface RunningBroker {
	/** number of connected clients (agents + adapter) */
	clients: () => number;
	/** stops the broker and closes all connections */
	close: () => Promise<void>;
}

/**
 * Compares two strings in constant time
 *
 * @param a first string
 * @param b second string
 */
export function sameSecret(a: string, b: string): boolean {
	const x = Buffer.from(a, 'utf8');
	const y = Buffer.from(b, 'utf8');
	return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Checks the login of a client
 *
 * @param opts broker options
 * @param username user name sent by the client
 * @param password password sent by the client
 */
export function checkLogin(opts: BrokerOptions, username: string | undefined, password: Buffer | undefined): boolean {
	if (!opts.username) {
		return true;
	}
	return (
		sameSecret(username ?? '', opts.username) && sameSecret(password?.toString('utf8') ?? '', opts.password ?? '')
	);
}

/**
 * Starts the broker
 *
 * @param opts options
 */
export async function startBroker(opts: BrokerOptions): Promise<RunningBroker> {
	// aedes is an ES module
	const { Aedes } = await import('aedes');
	const broker = await Aedes.createBroker({
		authenticate: (_client, username, password, done) => {
			const ok = checkLogin(opts, username, password);
			if (ok) {
				done(null, true);
			} else {
				const err = Object.assign(new Error('Bad user name or password'), { returnCode: 4 });
				done(err, false);
			}
		},
	});
	const sockets = new Set<Socket>();
	const server: Server = createServer(socket => {
		sockets.add(socket);
		socket.on('close', () => sockets.delete(socket));
		broker.handle(socket);
	});
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(opts.port, opts.bind || '0.0.0.0', () => {
			server.off('error', reject);
			resolve();
		});
	});
	return {
		clients: () => broker.connectedClients,
		close: async () => {
			for (const s of sockets) {
				s.destroy();
			}
			await new Promise<void>(resolve => server.close(() => resolve()));
			await new Promise<void>(resolve => broker.close(() => resolve()));
		},
	};
}
