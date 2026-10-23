// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			/** 'internal' = built-in broker, 'external' = existing broker */
			brokerMode: 'internal' | 'external';
			brokerPort: number;
			brokerBind: string;
			host: string;
			port: number;
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
