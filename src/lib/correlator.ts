/**
 * Correlates commands with the "result" messages of the agent via a generated id.
 * Timers are injected so the adapter can use its own (this.setTimeout) and tests can use plain ones.
 */

import type { ResultMessage } from './protocol';

/** Timer functions */
export interface Timers {
	set: (cb: () => void, ms: number) => unknown;
	clear: (handle: unknown) => void;
}

interface Pending {
	resolve: (r: ResultMessage) => void;
	reject: (e: Error) => void;
	timer: unknown;
	device: string;
}

/** Pending commands waiting for their result */
export class Correlator {
	private readonly pending = new Map<string, Pending>();
	private counter = 0;

	/**
	 * @param timers timer functions
	 */
	public constructor(private readonly timers: Timers) {}

	/** @returns number of pending commands */
	public get size(): number {
		return this.pending.size;
	}

	/**
	 * Registers a command and returns its id and a promise for the result.
	 *
	 * @param device device the command goes to
	 * @param timeoutMs timeout in ms
	 */
	public create(device: string, timeoutMs: number): { id: string; promise: Promise<ResultMessage> } {
		this.counter = (this.counter + 1) % 1_000_000;
		const id = `${Date.now().toString(36)}-${this.counter.toString(36)}`;
		const promise = new Promise<ResultMessage>((resolve, reject) => {
			const timer = this.timers.set(() => {
				this.pending.delete(id);
				reject(new Error(`timeout after ${Math.round(timeoutMs / 1000)} s`));
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
	public resolve(result: ResultMessage): boolean {
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
	public rejectAll(reason: string, device?: string): void {
		for (const [id, p] of this.pending) {
			if (device === undefined || p.device === device) {
				this.timers.clear(p.timer);
				this.pending.delete(id);
				p.reject(new Error(reason));
			}
		}
	}
}
