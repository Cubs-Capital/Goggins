import { Client, IAgentRuntime, elizaLogger, Memory, stringToUuid, State } from "@elizaos/core";
import { actions } from "@elizaos/plugin-broadcast";

const { apiCallAction } = actions;
if (!apiCallAction) {
    throw new Error("apiCallAction not found in broadcast plugin");
}

const AUTO_CLIENT_USER_ID = stringToUuid("auto-client");
const AUTO_CLIENT_ROOM_ID = stringToUuid("auto-client-room");
const FETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export class AutoClient {
    interval: NodeJS.Timeout;
    runtime: IAgentRuntime;

    constructor(runtime: IAgentRuntime) {
        this.runtime = runtime;
    }

    async start() {
        try {
            // Setup auto client user
            await this.runtime.ensureConnection(
                AUTO_CLIENT_USER_ID,
                AUTO_CLIENT_ROOM_ID,
                "Auto Client",
                "Auto Client",
                "auto"
            );
            elizaLogger.info("Auto client user setup complete");

            // Immediate first fetch
            await this.fetchBroadcasts();

            // Start background polling
            this.interval = setInterval(
                () => this.fetchBroadcasts(),
                FETCH_INTERVAL
            );
            elizaLogger.info(`Background polling started - fetching every ${FETCH_INTERVAL/1000}s`);
        } catch (error) {
            elizaLogger.error("Failed to start auto client:", error);
            throw error;
        }
    }

    private async fetchBroadcasts() {
        try {
            elizaLogger.info("Fetching broadcast data...");
            const message: Memory = {
                id: stringToUuid(Date.now().toString()),
                userId: AUTO_CLIENT_USER_ID,
                roomId: AUTO_CLIENT_ROOM_ID,
                agentId: this.runtime.agentId,
                content: { text: "Fetch broadcasts" },
                createdAt: Date.now()
            };

            const state: State = {
                bio: "",
                lore: "",
                messageDirections: "",
                postDirections: "",
                roomId: AUTO_CLIENT_ROOM_ID,
                recentMessages: "",
                recentMessagesData: [],
                actors: ""
            };

            await apiCallAction.handler(this.runtime, message, state, {});
            elizaLogger.info("Broadcast data fetch complete");
        } catch (error) {
            elizaLogger.error("Failed to fetch broadcasts:", error);
        }
    }

    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
            elizaLogger.info("Background polling stopped");
        }
    }
}

export const AutoClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        const client = new AutoClient(runtime);
        await client.start();
        return client;
    },
    stop: async (runtime: IAgentRuntime) => {
        if (runtime.clients?.auto) {
            const client = runtime.clients.auto as AutoClient;
            await client.stop();
        }
    }
};

export default AutoClientInterface;
