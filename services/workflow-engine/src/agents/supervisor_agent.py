"""
Supervisor agent for coordinating multiple specialist agents.
"""

from typing import List, Dict, Any, Optional
import logging
from openai import AsyncOpenAI
import os
import json

from .base_agent import BaseAgent
from .specialist_agent import SpecialistAgent

logger = logging.getLogger(__name__)


class SupervisorAgent(BaseAgent):
    """Supervisor agent that coordinates multiple specialist agents"""

    def __init__(self, name: str = "Supervisor", model: str = "gpt-4"):
        super().__init__(
            name=name,
            description="Coordinates and delegates tasks to specialist agents",
            model=model
        )
        self.specialists: List[SpecialistAgent] = []
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def add_specialist(self, specialist: SpecialistAgent):
        """Add a specialist agent to the team"""
        self.specialists.append(specialist)
        logger.info(f"Added specialist '{specialist.name}' with specialty '{specialist.specialty}'")

    async def execute(self, task: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Coordinate task execution across specialists"""
        try:
            logger.info(f"Supervisor coordinating task: {task}")

            # Determine which specialist(s) to use
            delegation_plan = await self._create_delegation_plan(task, context)

            results = []

            # Execute with each assigned specialist
            for step in delegation_plan.get("steps", []):
                agent_name = step.get("agent")
                subtask = step.get("task")

                # Find the specialist
                specialist = next(
                    (s for s in self.specialists if s.name == agent_name),
                    None
                )

                if specialist:
                    result = await specialist.execute(subtask, context)
                    results.append(result)
                    # Update context with result
                    context[f"{agent_name}_result"] = result
                else:
                    logger.warning(f"Specialist '{agent_name}' not found")

            # Aggregate results
            final_result = await self._aggregate_results(task, results, context)

            return {
                "success": True,
                "result": final_result,
                "delegation_plan": delegation_plan,
                "specialist_results": results
            }

        except Exception as e:
            logger.error(f"Supervisor failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def _create_delegation_plan(self, task: str, context: Dict[str, Any]) -> Dict:
        """Create a plan for delegating task to specialists"""
        try:
            # Get specialist descriptions
            specialists_info = [
                f"- {s.name}: {s.specialty} - {s.description}"
                for s in self.specialists
            ]

            prompt = f"""Given this task and available specialists, create a delegation plan.

Task: {task}

Available Specialists:
{chr(10).join(specialists_info)}

Create a JSON plan with steps, where each step specifies which agent should handle which subtask.

Example format:
{{
    "steps": [
        {{"agent": "Agent Name", "task": "Specific subtask"}},
        ...
    ]
}}
"""

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a task delegation expert. Create efficient delegation plans."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )

            plan = json.loads(response.choices[0].message.content)
            logger.info(f"Created delegation plan with {len(plan.get('steps', []))} steps")

            return plan

        except Exception as e:
            logger.error(f"Failed to create delegation plan: {e}")
            return {"steps": []}

    async def _aggregate_results(self, original_task: str, results: List[Dict], context: Dict) -> str:
        """Aggregate results from multiple specialists"""
        try:
            results_summary = "\n\n".join([
                f"Agent: {r.get('agent')}\nResult: {r.get('result')}"
                for r in results if r.get('success')
            ])

            prompt = f"""Given these results from specialist agents, provide a final comprehensive answer.

Original Task: {original_task}

Specialist Results:
{results_summary}

Provide a coherent, comprehensive final answer that synthesizes all specialist results."""

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert at synthesizing information from multiple sources."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5
            )

            return response.choices[0].message.content

        except Exception as e:
            logger.error(f"Failed to aggregate results: {e}")
            return "Failed to aggregate results"
