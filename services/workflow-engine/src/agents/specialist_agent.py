"""
Specialist AI agents for specific domains.
"""

from typing import Dict, Any
import logging
from openai import AsyncOpenAI
import os

from .base_agent import BaseAgent

logger = logging.getLogger(__name__)


class SpecialistAgent(BaseAgent):
    """Specialist agent for domain-specific tasks"""

    def __init__(self, name: str, description: str, specialty: str,
                 model: str = "gpt-4", system_prompt: str = None):
        super().__init__(name, description, model)
        self.specialty = specialty
        self.system_prompt = system_prompt or f"You are a {specialty} specialist."
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def execute(self, task: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute specialist task"""
        try:
            logger.info(f"Agent '{self.name}' executing task in specialty '{self.specialty}'")

            # Build messages
            messages = [
                {"role": "system", "content": self.system_prompt}
            ]

            # Add memory context
            messages.extend(self.memory)

            # Add current task
            messages.append({
                "role": "user",
                "content": f"Task: {task}\n\nContext: {context}"
            })

            # Call LLM
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7
            )

            result = response.choices[0].message.content

            # Store in memory
            self.add_memory("user", task)
            self.add_memory("assistant", result)

            logger.info(f"Agent '{self.name}' completed task")

            return {
                "success": True,
                "result": result,
                "agent": self.name,
                "specialty": self.specialty,
                "tokens_used": response.usage.total_tokens
            }

        except Exception as e:
            logger.error(f"Agent '{self.name}' failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "agent": self.name
            }
