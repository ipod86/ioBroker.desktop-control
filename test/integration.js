const path = require('node:path');
const net = require('node:net');
const { tests } = require('@iobroker/testing');
const { expect } = require('chai');
const { Aedes } = require('aedes');
const { startFakeAgent } = require('../tools/fake-agent');

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
	defineAdditionalTests({ suite }) {
		suite('With an in-memory MQTT broker and a fake agent', getHarness => {
			const NS = 'desktop-control.0';
			const wait = ms => new Promise(r => setTimeout(r, ms));
			let harness;
			let broker;
			let server;
			let agent;
			let port;
			const sockets = new Set();

			/**
			 * Waits until a state has a value (or the timeout passes)
			 *
			 * @param {string} id state id
			 * @param {(v: any) => boolean} [check] condition
			 * @param {number} [ms] timeout
			 */
			async function waitForState(id, check = v => v !== null && v !== undefined, ms = 10000) {
				const end = Date.now() + ms;
				while (Date.now() < end) {
					const st = await harness.states.getStateAsync(id);
					// only values confirmed by the adapter (ack=true)
					if (st && st.ack && check(st.val)) {
						return st;
					}
					await wait(200);
				}
				return harness.states.getStateAsync(id);
			}

			const sendTo = (command, message) => new Promise(resolve => harness.sendTo(NS, command, message, resolve));

			before(async function () {
				this.timeout(60000);
				broker = await Aedes.createBroker();
				server = net.createServer(socket => {
					sockets.add(socket);
					socket.on('close', () => sockets.delete(socket));
					broker.handle(socket);
				});
				await new Promise(r => server.listen(0, '127.0.0.1', r));
				port = server.address().port;
				harness = getHarness();
				const obj = await harness.objects.getObjectAsync(`system.adapter.${NS}`);
				// the cached test installation may still have an instance object from before messagebox was enabled
				obj.common.messagebox = true;
				Object.assign(obj.native, {
					brokerMode: 'external',
					host: '127.0.0.1',
					port,
					topicBase: 'winctl',
					cmdTimeout: 5,
				});
				await harness.objects.setObjectAsync(obj._id, obj);
				agent = await startFakeAgent({ url: `mqtt://127.0.0.1:${port}`, device: 'fake-pc' });
				await harness.startAdapterAndWait();
				await harness.enableSendTo();
				await waitForState(`${NS}.fake-pc.online`, v => v === true);
				// manifest applied (the info log comes after all objects exist)
				await waitForState(`${NS}.fake-pc.info.apps`, v => v !== null, 30000);
			});

			after(async function () {
				this.timeout(10000);
				if (agent) {
					await agent.client.endAsync(true);
				}
				// the adapter keeps its connection open, so close it from the broker side
				for (const s of sockets) {
					s.destroy();
				}
				await new Promise(r => server.close(r));
				await new Promise(r => broker.close(r));
			});

			it('connects to the broker', async () => {
				const conn = await waitForState(`${NS}.info.connection`, v => v === true);
				expect(conn && conn.val).to.equal(true);
			});

			it('creates the device from the manifest', async () => {
				const dev = await harness.objects.getObjectAsync(`${NS}.fake-pc`);
				expect(dev.type).to.equal('device');
				expect(dev.common.name).to.equal('FAKE-PC');
				const online = await harness.objects.getObjectAsync(`${NS}.fake-pc.online`);
				expect(online.common.role).to.equal('indicator.reachable');
				const host = await waitForState(`${NS}.fake-pc.info.hostname`);
				expect(host.val).to.equal('FAKE-PC');
			});

			it('writes the states of the agent with ack and creates dynamic states', async () => {
				const vol = await waitForState(`${NS}.fake-pc.state.volume`);
				expect(vol.val).to.equal(40);
				expect(vol.ack).to.equal(true);
				const volObj = await harness.objects.getObjectAsync(`${NS}.fake-pc.state.volume`);
				expect(volObj.common).to.include({ role: 'level.volume', unit: '%', write: true });
				const disk = await waitForState(`${NS}.fake-pc.state.disk.C_used_percent`);
				expect(disk.val).to.equal(55);
				const diskObj = await harness.objects.getObjectAsync(`${NS}.fake-pc.state.disk.C_used_percent`);
				expect(diskObj.common).to.include({ unit: '%', type: 'number' });
			});

			it('creates command data points: buttons, json, none for dangerous commands', async () => {
				const ping = await harness.objects.getObjectAsync(`${NS}.fake-pc.cmd.ping`);
				expect(ping.common.role).to.equal('button');
				const vol = await harness.objects.getObjectAsync(`${NS}.fake-pc.cmd.volume`);
				expect(vol.common.role).to.equal('json');
				const shell = await harness.objects.getObjectAsync(`${NS}.fake-pc.cmd.shell`);
				expect(shell).to.equal(null);
				// run is limited to the aliases of the agent, so it gets a data point with them as a list
				const run = await harness.objects.getObjectAsync(`${NS}.fake-pc.cmd.run`);
				expect(run.common.states).to.deep.equal({ notepad: 'notepad', calc: 'calc' });
				// switched off in the agent config
				const beep = await harness.objects.getObjectAsync(`${NS}.fake-pc.cmd.beep`);
				expect(beep).to.equal(null);
				const apps = await waitForState(`${NS}.fake-pc.info.apps`);
				expect(JSON.parse(apps.val)).to.deep.equal(['notepad', 'calc']);
				const all = await harness.objects.getObjectAsync(`${NS}.all.cmd.ping`);
				expect(all.common.role).to.equal('button');
			});

			it('answers sendTo with the result of the agent', async function () {
				this.timeout(15000);
				const res = await sendTo('cmd', { device: 'fake-pc', command: 'ping' });
				expect(res).to.include({ ok: true, command: 'ping', result: 'pong' });
				const byHost = await sendTo('cmd', { device: 'FAKE-PC', command: 'ping' });
				expect(byHost.ok).to.equal(true);
				const devices = await sendTo('devices', {});
				expect(devices[0]).to.include({ device: 'fake-pc', online: true });
			});

			it('sends a command when a writable state is changed', async function () {
				this.timeout(15000);
				await harness.states.setStateAsync(`${NS}.fake-pc.state.volume`, 70, false);
				const vol = await waitForState(`${NS}.fake-pc.state.volume`, v => v === 70);
				expect(vol.val).to.equal(70);
				expect(vol.ack).to.equal(true);
			});

			it('executes a json command data point and stores the result', async function () {
				this.timeout(15000);
				await harness.states.setStateAsync(`${NS}.fake-pc.cmd.volume`, '{"level":25}', false);
				const vol = await waitForState(`${NS}.fake-pc.state.volume`, v => v === 25);
				expect(vol.val).to.equal(25);
				const result = await waitForState(`${NS}.fake-pc.result`, v => String(v).includes('"level":25'));
				expect(JSON.parse(result.val)).to.include({ command: 'volume', ok: true });
			});

			it('sends a button command', async function () {
				this.timeout(15000);
				await harness.states.setStateAsync(`${NS}.fake-pc.cmd.lock`, true, false);
				const locked = await waitForState(`${NS}.fake-pc.state.locked`, v => v === true);
				expect(locked.val).to.equal(true);
				const ev = await waitForState(`${NS}.fake-pc.event.lock`);
				expect(JSON.parse(ev.val)).to.have.property('ts');
			});

			it('accepts the short form for the primary parameter', async function () {
				this.timeout(15000);
				const res = await sendTo('cmd', { device: 'fake-pc', command: 'speak', params: 'Hallo Welt' });
				expect(res).to.deep.include({ ok: true, result: { text: 'Hallo Welt' } });
			});

			it('switches keep_awake via the writable state', async function () {
				this.timeout(15000);
				await harness.states.setStateAsync(`${NS}.fake-pc.state.keep_awake`, true, false);
				const st = await waitForState(`${NS}.fake-pc.state.keep_awake`, v => v === true);
				expect(st.val).to.equal(true);
			});

			it('stores screenshots in the file storage', async function () {
				this.timeout(15000);
				const res = await sendTo('cmd', { device: 'fake-pc', command: 'screenshot' });
				expect(res.ok).to.equal(true);
				const shot = await waitForState(`${NS}.fake-pc.screenshot`);
				expect(shot.val).to.equal(`/${NS}/screenshots/fake-pc.png`);
				const file = await new Promise((resolve, reject) =>
					harness.objects.readFile(NS, 'screenshots/fake-pc.png', null, (err, data) =>
						err ? reject(err) : resolve(data),
					),
				);
				expect(file.length).to.be.greaterThan(10);
			});

			it('answers commands to an offline device immediately with an error', async function () {
				this.timeout(15000);
				await agent.stop();
				agent = null;
				await waitForState(`${NS}.fake-pc.online`, v => v === false);
				const res = await sendTo('cmd', { device: 'fake-pc', command: 'ping' });
				expect(res.ok).to.equal(false);
				expect(res.error).to.match(/offline/);
			});
		});

		suite('With the built-in broker', getHarness => {
			const NS = 'desktop-control.0';
			const wait = ms => new Promise(r => setTimeout(r, ms));
			let harness;
			let port;

			const freePort = () =>
				new Promise(resolve => {
					const srv = net.createServer();
					srv.listen(0, '127.0.0.1', () => {
						const p = srv.address().port;
						srv.close(() => resolve(p));
					});
				});

			before(async function () {
				this.timeout(60000);
				port = await freePort();
				harness = getHarness();
				const obj = await harness.objects.getObjectAsync(`system.adapter.${NS}`);
				obj.common.messagebox = true;
				Object.assign(obj.native, {
					brokerMode: 'internal',
					brokerPort: port,
					brokerBind: '127.0.0.1',
					host: '',
					username: 'agent',
					password: 'secret',
					topicBase: 'winctl',
				});
				await harness.objects.setObjectAsync(obj._id, obj);
				await harness.startAdapterAndWait();
				await harness.enableSendTo();
			});

			it('lets agents with the right login connect', async function () {
				this.timeout(30000);
				let conn;
				for (let i = 0; i < 50 && !(conn && conn.val); i++) {
					await wait(200);
					conn = await harness.states.getStateAsync(`${NS}.info.connection`);
				}
				expect(conn.val).to.equal(true);
				const agent = await startFakeAgent({
					url: `mqtt://127.0.0.1:${port}`,
					device: 'built-in-pc',
					username: 'agent',
					password: 'secret',
				});
				try {
					let online;
					for (let i = 0; i < 50 && !(online && online.val); i++) {
						await wait(200);
						online = await harness.states.getStateAsync(`${NS}.built-in-pc.online`);
					}
					expect(online.val).to.equal(true);
					const res = await new Promise(resolve =>
						harness.sendTo(NS, 'cmd', { device: 'built-in-pc', command: 'ping' }, resolve),
					);
					expect(res.ok).to.equal(true);
				} finally {
					await agent.client.endAsync(true);
				}
			});

			it('rejects agents with a wrong login', async function () {
				this.timeout(15000);
				let error;
				try {
					await startFakeAgent({
						url: `mqtt://127.0.0.1:${port}`,
						device: 'intruder',
						username: 'agent',
						password: 'wrong',
					});
				} catch (e) {
					error = e;
				}
				expect(error).to.be.an('error');
			});
		});
	},
});
