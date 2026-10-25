// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			/** 'internal' = built-in broker, 'external' = existing broker */
			brokerMode: 'internal' | 'external';
			/** port of the built-in broker (own server, therefore "port"/"bind" as required by ioBroker) */
			port: number;
			/** listen address of the built-in broker */
			bind: string;
			/** existing broker: host and port */
			host: string;
			hostPort: number;
			/** older settings (port/bind of the built-in broker before the rename), migrated on start */
			brokerPort?: number | null;
			brokerBind?: string | null;
			username: string;
			password: string;
			tls: boolean;
			rejectUnauthorized: boolean;
			topicBase: string;
			clientId: string;
			cmdTimeout: number;
			askTimeout: number;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
