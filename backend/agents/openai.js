import OpenAI from 'openai';

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @param {string} systemPrompt
 * @returns {Promise<string>}
 */
export async function callOpenAI(messages, systemPrompt, maxTokens = 300) {
  // Instantiate lazily so the server starts even before keys are set
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    max_tokens: maxTokens,
    temperature: 1.05,
  });

  return response.choices[0].message.content.trim();
}
