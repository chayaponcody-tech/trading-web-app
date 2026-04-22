"""
LLM Client Wrapper for Quant Engine
Integrates with OpenRouter/OpenAI API.
"""
import httpx
import logging
from typing import Any, Optional, Callable

logger = logging.getLogger(__name__)

class LLMClient:
    def __init__(self, api_key_factory: Callable[[], str], default_model: str = "anthropic/claude-3-haiku"):
        self.api_key_factory = api_key_factory
        self.default_model = default_model
        self.base_url = "https://openrouter.ai/api/v1"

    async def complete(self, prompt: str, model: Optional[str] = None) -> str:
        target_model = model or self.default_model
        api_key = self.api_key_factory()
        
        if not api_key or api_key == "NOT_SET":
            return "Error: OpenRouter API Key not set in configuration."

        logger.info(f"LLM: Requesting completion from {target_model}")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:4000",
            "X-Title": "Quant Intelligence Hub"
        }
        
        payload = {
            "model": target_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7
        }
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
                if resp.status_code != 200:
                    logger.error(f"LLM failure ({resp.status_code}): {resp.text}")
                    return f"Error: LLM returned status {resp.status_code} ({resp.text})"
                
                data = resp.json()
                return data['choices'][0]['message']['content']
        except Exception as e:
            logger.error(f"LLM connection error: {e}")
            return f"Error: {str(e)}"
