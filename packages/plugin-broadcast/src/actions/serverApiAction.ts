import {
    Action,
    IAgentRuntime,
    Memory,
    HandlerCallback,
    State,
    elizaLogger,
} from "@elizaos/core";

export const serverApiAction: Action = {
    name: "serverApiAction",
    similes: ["FETCH_SERVER_DATA", "GET_SERVER_DATA", "QUERY_SERVER"],
    description: "Fetch data from the local Node.js server",
    examples: [
        [
            { user: "user1", content: { text: "Get customer data from server" } },
            { user: "assistant", content: { text: "Fetching customer data from server", action: "serverApiAction" } }
        ]
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => true,
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        try {
            elizaLogger.info('Starting data fetch from local server');

            // Extract endpoint from message or options
            const endpoint = options?.endpoint || 'customers'; // Default to customers endpoint
            const method = options?.method || 'GET';
            const body = options?.body;

            const baseUrl = process.env.SERVER_URL || 'http://localhost:5000';
            const url = `${baseUrl}/api/${endpoint}`;

            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };

            // Add authorization if provided
            if (options?.token) {
                headers['Authorization'] = `Bearer ${options.token as string}`;
            }

            const fetchOptions: RequestInit = {
                method: method as string,
                headers,
                credentials: 'include',
            };

            if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                fetchOptions.body = JSON.stringify(body);
            }

            const response = await fetch(url, fetchOptions);
            elizaLogger.debug('Received response from server');

            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            const data = await response.json();

            // Ensure connection exists before creating memory
            await runtime.ensureConnection(
                message.userId,
                message.roomId,
                "API User",
                "API User",
                "api"
            );

            // Store in memory for immediate use
            const memory: Memory = {
                id: crypto.randomUUID(),
                content: {
                    text: JSON.stringify(data),
                    raw: data
                },
                roomId: message.roomId,
                userId: message.userId,
                agentId: runtime.agentId,
                createdAt: Date.now()
            };

            await runtime.messageManager.createMemory(memory);

            callback?.({
                text: JSON.stringify(data)
            });

            return true;
        } catch (error) {
            elizaLogger.error('Error in server data processing:', error);
            elizaLogger.debug('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });

            callback?.({ text: `Error processing server data: ${error.message}` });
            return false;
        }
    }
}