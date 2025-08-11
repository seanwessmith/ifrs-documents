import type { Config } from '../../core/src/index.ts';

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  maxRetries: number = 3
): Promise<{ content: string; usage?: any }> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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

      if (response.status === 429) {
        // Rate limit hit, exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000; // 2-6s, 4-12s, 8-24s
          console.warn(`    Rate limit hit, retrying in ${Math.round(delay/1000)}s... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
      }

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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      if (attempt === maxRetries) {
        break;
      }
      // For non-rate-limit errors, wait a bit before retrying
      if (!lastError.message.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  throw lastError!;
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