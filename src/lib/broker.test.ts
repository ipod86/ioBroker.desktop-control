import { expect } from 'chai';
import { checkLogin, sameSecret } from './broker';

describe('built-in broker login', () => {
	it('compares secrets', () => {
		expect(sameSecret('abc', 'abc')).to.equal(true);
		expect(sameSecret('abc', 'abd')).to.equal(false);
		expect(sameSecret('abc', 'abcd')).to.equal(false);
	});
	it('accepts everyone without a configured login', () => {
		expect(checkLogin({ port: 1, bind: '' }, undefined, undefined)).to.equal(true);
	});
	it('checks user name and password', () => {
		const opts = { port: 1, bind: '', username: 'agent', password: 'secret' };
		expect(checkLogin(opts, 'agent', Buffer.from('secret'))).to.equal(true);
		expect(checkLogin(opts, 'agent', Buffer.from('nope'))).to.equal(false);
		expect(checkLogin(opts, 'other', Buffer.from('secret'))).to.equal(false);
		expect(checkLogin(opts, undefined, undefined)).to.equal(false);
	});
});
