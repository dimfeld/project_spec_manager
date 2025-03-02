/**
 * Utility functions for the Automated Development Task Manager
 */

import { OpenAI } from 'ai';

/**
 * Query a language model with a prompt
 * @param prompt The prompt to send to the language model
 * @returns Promise resolving to the language model response
 * @throws Error if the language model API key is not set or the API call fails
 */
export async function queryLanguageModel(prompt: string): Promise<string> {
  const apiKey = process.env.LANGUAGE_MODEL_API_KEY;
  if (!apiKey) {
    throw new Error('LANGUAGE_MODEL_API_KEY environment variable not set');
  }
  
  try {
    console.log(`[Language Model] Sending prompt to API...`);
    
    // Initialize the OpenAI client from the Vercel AI SDK
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    // Create a system message that sets the context for the AI
    const systemMessage = `You are an AI assistant helping with software development tasks. 
    Analyze the provided information and respond concisely and accurately.`;
    
    // Create the chat completion request
    const response = await openai.chat.completions.create({
      model: "gpt-4", // You can configure this based on your needs
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more deterministic responses
      max_tokens: 500,  // Limit response length
    });
    
    // Extract the response content
    const responseContent = response.choices[0]?.message?.content || '';
    
    if (!responseContent) {
      console.warn('[Language Model] Received empty response from API');
      return 'No response received from language model.';
    }
    
    console.log(`[Language Model] Received response from API`);
    return responseContent;
    
  } catch (error) {
    // Handle specific API errors
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 401) {
        console.error('[Language Model] Authentication error: Invalid API key');
        throw new Error('Invalid API key. Please check your LANGUAGE_MODEL_API_KEY environment variable.');
      } else if (status === 429) {
        console.error('[Language Model] Rate limit exceeded');
        throw new Error('API rate limit exceeded. Please try again later.');
      } else if (status === 500) {
        console.error('[Language Model] Server error from API provider');
        throw new Error('Language model API server error. Please try again later.');
      }
      
      console.error(`[Language Model] API error: ${status}`, errorData);
      throw new Error(`Language model API error: ${errorData?.error?.message || 'Unknown error'}`);
    }
    
    // Handle network or other errors
    console.error(`[Language Model] Error querying language model:`, error);
    throw new Error(`Error querying language model: ${error.message}`);
  }
}

/**
 * Format a timestamp for logging
 * @returns Formatted timestamp string
 */
export function getFormattedTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Safely execute a function and catch any errors
 * @param fn Function to execute
 * @param errorMessage Message to include in error if function throws
 * @returns Result of the function or null if it throws
 */
export async function safeExecute<T>(fn: () => Promise<T>, errorMessage: string): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    console.error(`${errorMessage}: ${error.message}`);
    return null;
  }
}