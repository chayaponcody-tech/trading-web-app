
export interface AIModel {
  value: string;
  label: string;
  description?: string;
}

export const AI_MODELS: AIModel[] = [
  { value: 'google/gemini-flash-1.5', label: '⚡ Gemini Flash 1.5 (Fast)' },
  { value: 'google/gemini-pro-1.5', label: '♊ Gemini Pro 1.5' },
  { value: 'google/gemini-3-flash-preview', label: '🔮 Gemini 3 Flash Preview' },
  { value: 'anthropic/claude-3.5-sonnet', label: '🎭 Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-3-haiku', label: '🪶 Claude 3 Haiku (Fast)' },
  { value: 'deepseek/deepseek-chat', label: '🤖 DeepSeek V3' },
  { value: 'deepseek/deepseek-reasoner', label: '🧠 DeepSeek R1 (Reasoning)' },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: '🦙 Llama 3.3 70B' },
  { value: 'meta-llama/llama-3.1-405b', label: '🦙 Llama 3.1 405B' },
  { value: 'qwen/qwen-2.5-72b-instruct', label: '🐉 Qwen 2.5 72B' },
  { value: 'mistralai/pixtral-large-2411', label: '🌪️ Mistral Large 2' },
];
