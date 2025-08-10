import type { Config } from '@ifrs/core';

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<{ content: string; usage?: any }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Claude API error: ${data.error.message}`);
  }

  return {
    content: data.content[0].text,
    usage: data.usage,
  };
}

export function parseJsonResponse<T>(content: string, schema: any): T[] {
  try {
    let jsonStr = content.trim();
    
    // Remove common prefixes like "Here is the JSON array..."
    const jsonMatch = jsonStr.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    // Remove markdown code blocks
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    const result = schema.parse(parsed);
    
    return Array.isArray(result) ? result : [result];
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}\nContent: ${content}`);
  }
}