import { expect } from 'chai';
import { magicPacket, normalizeMac } from './wol';

describe('Wake-on-LAN', () => {
	it('normalises MAC addresses', () => {
		expect(normalizeMac('bc-24-11-43-cf-57')).to.equal('BC:24:11:43:CF:57');
		expect(normalizeMac('BC241143CF57')).to.equal('BC:24:11:43:CF:57');
		expect(normalizeMac('00:00:00:00:00:00')).to.equal(null);
		expect(normalizeMac('nope')).to.equal(null);
		expect(normalizeMac(undefined)).to.equal(null);
	});
	it('builds the magic packet', () => {
		const p = magicPacket('BC:24:11:43:CF:57');
		expect(p.length).to.equal(102);
		expect(p.subarray(0, 6).equals(Buffer.alloc(6, 0xff))).to.equal(true);
		expect(p.subarray(6, 12).toString('hex')).to.equal('bc241143cf57');
		expect(p.subarray(96, 102).toString('hex')).to.equal('bc241143cf57');
		expect(() => magicPacket('x')).to.throw();
	});
});
