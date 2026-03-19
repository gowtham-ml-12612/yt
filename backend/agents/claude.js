import Anthropic from '@anthropic-ai/sdk';

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @param {string} systemPrompt
 * @returns {Promise<string>}
 */
export async function callClaude(messages, systemPrompt, maxTokens = 300) {
  // Instantiate lazily so the server starts even before keys are set
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Anthropic requires messages to start with role 'user'.
  // If the first message is 'assistant', prepend a minimal user seed.
  const normalized = normalizeMessages(messages);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: normalized,
  });

  return response.content[0].text.trim();
}

/**
 * Anthropic's API requires:
 * 1. Messages array must not be empty
 * 2. First message must have role 'user'
 * 3. Roles must strictly alternate user / assistant
 *
 * If history is empty (first turn), inject a seed user message.
 */
function normalizeMessages(messages) {
  if (messages.length === 0) {
    return [{ role: 'user', content: 'Please share your opening thoughts on the topic.' }];
  }

  // If first message is 'assistant', prepend seed
  if (messages[0].role === 'assistant') {
    return [
      { role: 'user', content: 'Please share your opening thoughts on the topic.' },
      ...messages,
    ];
  }

  return messages;
}
