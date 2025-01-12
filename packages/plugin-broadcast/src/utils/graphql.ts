import { elizaLogger } from '@elizaos/core';
import { FeedResponse, ProfileResponse, TokenResponse } from './types';

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://mainnet-api.vector.fun/graphql';

export async function makeGraphQLRequestWithRetry<T extends FeedResponse | ProfileResponse | TokenResponse>(
    query: string,
    variables: any,
    maxRetries = 3
): Promise<{ data: T }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.errors) {
                throw new Error(result.errors[0]?.message || 'GraphQL error');
            }

            return result;
        } catch (error) {
            lastError = error as Error;
            elizaLogger.warn(`GraphQL request failed (attempt ${attempt + 1}/${maxRetries}):`, error);
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    throw lastError || new Error('GraphQL request failed after retries');
}