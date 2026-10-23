import { expect } from 'chai';
import { Correlator } from './correlator';

/**
 * Resolves to the error message of a rejected promise
 *
 * @param p promise
 */
async function rejection(p: Promise<unknown>): Promise<string> {
	try {
		await p;
	} catch (e) {
		return (e as Error).message;
	}
	return 'resolved';
}

const timers = {
	set: (cb: () => void, ms: number): unknown => setTimeout(cb, ms),
	clear: (h: unknown): void => clearTimeout(h as NodeJS.Timeout),
};

describe('Correlator', () => {
	it('resolves the matching result and ignores unknown ids', async () => {
		const c = new Correlator(timers);
		const { id, promise } = c.create('pc1', 1000);
		expect(c.resolve({ id: 'other', command: 'ping', ok: true })).to.equal(false);
		expect(c.resolve({ id, command: 'ping', ok: true, result: 'pong' })).to.equal(true);
		expect((await promise).result).to.equal('pong');
		expect(c.size).to.equal(0);
	});
	it('rejects on timeout', async () => {
		const c = new Correlator(timers);
		const { promise } = c.create('pc1', 20);
		expect(await rejection(promise)).to.match(/timeout/);
		expect(c.size).to.equal(0);
	});
	it('rejects pending commands of one device', async () => {
		const c = new Correlator(timers);
		const a = c.create('pc1', 1000);
		const b = c.create('pc2', 1000);
		c.rejectAll('offline', 'pc1');
		expect(await rejection(a.promise)).to.equal('offline');
		expect(c.size).to.equal(1);
		c.rejectAll('stop');
		expect(await rejection(b.promise)).to.equal('stop');
	});
});
