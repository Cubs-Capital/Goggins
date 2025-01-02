import { composeContext } from "@elizaos/core";
import { generateText, trimTokens } from "@elizaos/core";
import type { TiktokenModel } from "js-tiktoken";
import { models } from "@elizaos/core";
import { parseJSONObjectFromText } from "@elizaos/core";
import {
    Action,
    ActionExample,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
} from "@elizaos/core";
import * as fs from "fs";
import * as path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const summarizationTemplate = `# Summarized so far (we are adding to this)
{{currentSummary}}

# Current attachments we are summarizing
{{attachmentsWithText}}

Summarization objective: {{objective}}

# Instructions: Summarize the attachments. Return the summary. Do not acknowledge this request, just summarize and continue the existing summary if there is one. Capture any important details based on the objective. Only respond with the new summary text.`;

export const attachmentIdsTemplate = `# Messages we are summarizing
{{recentMessages}}

# Instructions: {{senderName}} is requesting a summary of specific attachments. Your goal is to determine their objective, along with the list of attachment IDs to summarize.
The "objective" is a detailed description of what the user wants to summarize based on the conversation.
The "attachmentIds" is an array of attachment IDs that the user wants to summarize. If not specified, default to including all attachments from the conversation.

Your response must be formatted as a JSON block with this structure:
\`\`\`json
{
  "objective": "<What the user wants to summarize>",
  "attachmentIds": ["<Attachment ID 1>", "<Attachment ID 2>", ...]
}
\`\`\`
`;

const getAttachmentIds = async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
): Promise<{ objective: string; attachmentIds: string[] } | null> => {
    state = (await runtime.composeState(message)) as State;

    const context = composeContext({
        state,
        template: attachmentIdsTemplate,
    });

    for (let i = 0; i < 5; i++) {
        const response = await generateText({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });
        console.log("response", response);
        // try parsing to a json object
        const parsedResponse = parseJSONObjectFromText(response) as {
            objective: string;
            attachmentIds: string[];
        } | null;
        // see if it contains objective and attachmentIds
        if (parsedResponse?.objective && parsedResponse?.attachmentIds) {
            return parsedResponse;
        }
    }
    return null;
};

const summarizeAction = {
    name: "CHAT_WITH_ATTACHMENTS",
    similes: [
        "CHAT_WITH_ATTACHMENT",
        "SUMMARIZE_FILES",
        "SUMMARIZE_FILE",
        "SUMMARIZE_ATACHMENT",
        "CHAT_WITH_PDF",
        "ATTACHMENT_SUMMARY",
        "RECAP_ATTACHMENTS",
        "SUMMARIZE_FILE",
        "SUMMARIZE_VIDEO",
        "SUMMARIZE_AUDIO",
        "SUMMARIZE_IMAGE",
        "SUMMARIZE_DOCUMENT",
        "SUMMARIZE_LINK",
        "ATTACHMENT_SUMMARY",
        "FILE_SUMMARY",
    ],
    description:
        "Answer a user request informed by specific attachments based on their IDs. If a user asks to chat with a PDF, or wants more specific information about a link or video or anything else they've attached, this is the action to use.",
    validate: async (
        _runtime: IAgentRuntime,
        message: Memory,
        _state: State
    ) => {
        if (message.content.source !== "discord") {
            return false;
        }
        // only show if one of the keywords are in the message
        const keywords: string[] = [
            "attachment",
            "summary",
            "summarize",
            "research",
            "pdf",
            "video",
            "audio",
            "image",
            "document",
            "link",
            "file",
            "attachment",
            "summarize",
            "code",
            "report",
            "write",
            "details",
            "information",
            "talk",
            "chat",
            "read",
            "listen",
            "watch",
        ];
        return keywords.some((keyword) =>
            message.content.text.toLowerCase().includes(keyword.toLowerCase())
        );
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback
    ) => {
        state = (await runtime.composeState(message)) as State;

        const callbackData: Content = {
            text: "", // fill in later
            action: "CHAT_WITH_ATTACHMENTS_RESPONSE",
            source: message.content.source,
            attachments: [],
        };

        // 1. extract attachment IDs from the message
        const attachmentData = await getAttachmentIds(runtime, message, state);
        if (!attachmentData) {
            console.error("Couldn't get attachment IDs from message");
            return;
        }

        const { objective, attachmentIds } = attachmentData;

        // Improve the attachment filtering logic
        const attachments = state.recentMessagesData
            .filter(
                (msg) =>
                    msg.content.attachments &&
                    msg.content.attachments.length > 0
            )
            .flatMap((msg) => msg.content.attachments)
            .filter((attachment) => {
                if (!attachment?.id) return false;

                return attachmentIds.some(attId => {
                    if (!attId) return false;
                    const normalizedAttId = attId.toLowerCase();
                    const normalizedId = attachment.id.toLowerCase();

                    // Check if either ID contains the other
                    return normalizedId.includes(normalizedAttId) ||
                           normalizedAttId.includes(normalizedId);
                });
            });

        const attachmentsWithText = attachments
            .map((attachment) => `# ${attachment.title}\n${attachment.text}`)
            .join("\n\n");

        let currentSummary = "";

        const model = models[runtime.character.modelProvider];
        const chunkSize = model.settings.maxOutputTokens;

        state.attachmentsWithText = attachmentsWithText;
        state.objective = objective;

        const context = composeContext({
            state,
            // make sure it fits, we can pad the tokens a bit
            // Get the model's tokenizer based on the current model being used
            template: trimTokens(
                summarizationTemplate,
                chunkSize + 500,
                (model.model[ModelClass.SMALL] ||
                    "gpt-4o-mini") as TiktokenModel // Use the same model as generation; Fallback if no SMALL model configured
            ),
        });

        const summary = await generateText({
            runtime,
            context,
            modelClass: ModelClass.SMALL,
        });

        currentSummary = currentSummary + "\n" + summary;

        if (!currentSummary) {
            console.error("No summary found, that's not good!");
            return;
        }

        callbackData.text = currentSummary.trim();
        if (
            callbackData.text &&
            (currentSummary.trim()?.split("\n").length < 4 ||
                currentSummary.trim()?.split(" ").length < 100)
        ) {
            callbackData.text = `Here is the summary:
\`\`\`md
${currentSummary.trim()}
\`\`\`
`;
            await callback(callbackData);
        } else if (currentSummary.trim()) {
            await callback(
                {
                    ...callbackData,
                    text: "Here's the summary of the requested attachments:",
                    attachments: [{
                        url: null,
                        id: `summary_${Date.now()}`,
                        text: currentSummary,
                        title: "Summary",
                        type: 'text/markdown'
                    }]
                }
            );
        } else {
            console.warn(
                "Empty response from chat with attachments action, skipping"
            );
        }

        return callbackData;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you summarize the attachments b3e23, c4f67, and d5a89?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Sure thing! I'll pull up those specific attachments and provide a summary of their content.",
                    action: "CHAT_WITH_ATTACHMENTS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I need a technical summary of the PDFs I sent earlier - a1b2c3.pdf, d4e5f6.pdf, and g7h8i9.pdf",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll take a look at those specific PDF attachments and put together a technical summary for you. Give me a few minutes to review them.",
                    action: "CHAT_WITH_ATTACHMENTS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you watch this video for me and tell me which parts you think are most relevant to the report I'm writing? (the one I attached in my last message)",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "sure, no problem.",
                    action: "CHAT_WITH_ATTACHMENTS",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "can you read my blog post and give me a detailed breakdown of the key points I made, and then suggest a handful of tweets to promote it?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "great idea, give me a minute",
                    action: "CHAT_WITH_ATTACHMENTS",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;

export default summarizeAction;
