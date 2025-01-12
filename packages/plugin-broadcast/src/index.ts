import { Plugin } from '@elizaos/core';
import { apiCallAction, enhancedBroadcastTrackerAction, serverApiAction } from './actions';
import * as types from './types';
import { broadcastDataEvaluator } from './evaluators/broadcastDataEvaluator';
import { factEvaluator, evaluateBroadcasts } from './evaluators/fact';
import { factsProvider } from './providers/facts';
import { fetchProfilesAction } from './actions/fetchProfiles';

// Export the actions object that client-auto is expecting
export const actions = {
    apiCallAction,
    enhancedBroadcastTrackerAction,
    serverApiAction,
    fetchProfilesAction
};

export * as evaluators from "./evaluators";
export * as providers from "./providers";
export * from './utils/graphql';
export * from './evaluators/broadcastEvaluator';
export * from './actions/fetchProfiles';
export { types };

class BroadcastPlugin implements Plugin {
    name = "broadcast";
    description = "Broadcast data plugin";
    actions = [apiCallAction, enhancedBroadcastTrackerAction, serverApiAction, fetchProfilesAction];
    providers = [factsProvider];
    evaluators = [evaluateBroadcasts, broadcastDataEvaluator, factEvaluator];
}

const broadcastPlugin = new BroadcastPlugin();
export { broadcastPlugin };
export default broadcastPlugin;


