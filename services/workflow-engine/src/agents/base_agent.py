"""
Base agent class for autonomous AI agents.
"""

from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
import logging

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Base class for all AI agents"""

    def __init__(self, name: str, description: str, model: str = "gpt-4"):
        self.name = name
        self.description = description
        self.model = model
        self.memory = []
        self.tools = []

    @abstractmethod
    async def execute(self, task: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent task"""
        pass

    def add_tool(self, tool: callable):
        """Add a tool to agent's capabilities"""
        self.tools.append(tool)

    def add_memory(self, role: str, content: str):
        """Add to agent memory"""
        self.memory.append({"role": role, "content": content})

    def get_memory(self) -> List[Dict]:
        """Get agent memory"""
        return self.memory

    def clear_memory(self):
        """Clear agent memory"""
        self.memory = []
