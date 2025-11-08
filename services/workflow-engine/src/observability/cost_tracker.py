"""
Cost Tracker Module

Tracks LLM API costs and provides cost analytics.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from collections import defaultdict

logger = logging.getLogger(__name__)


@dataclass
class CostRecord:
    """Record of a cost-incurring operation."""
    timestamp: datetime
    workflow_id: int
    execution_id: int
    node_id: str
    service: str
    model: str
    tokens_input: int
    tokens_output: int
    cost_usd: float
    metadata: Dict[str, Any]


class CostTracker:
    """
    Tracks costs for LLM API calls and other paid services.

    Provides detailed cost analytics and budget monitoring.
    """

    def __init__(self):
        """Initialize cost tracker."""
        # Cost records
        self.records: List[CostRecord] = []

        # Pricing per model (cost per 1M tokens)
        self.pricing = {
            'gpt-4-turbo-preview': {
                'input': 10.0,
                'output': 30.0
            },
            'gpt-4': {
                'input': 30.0,
                'output': 60.0
            },
            'gpt-3.5-turbo': {
                'input': 0.5,
                'output': 1.5
            },
            'claude-3-opus': {
                'input': 15.0,
                'output': 75.0
            },
            'claude-3-sonnet': {
                'input': 3.0,
                'output': 15.0
            },
            'claude-3-haiku': {
                'input': 0.25,
                'output': 1.25
            }
        }

        logger.info("Cost tracker initialized")

    async def record_llm_call(
        self,
        workflow_id: int,
        execution_id: int,
        node_id: str,
        model: str,
        tokens_input: int,
        tokens_output: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> float:
        """
        Record an LLM API call and calculate cost.

        Args:
            workflow_id: Workflow ID
            execution_id: Execution ID
            node_id: Node ID
            model: Model name
            tokens_input: Input tokens
            tokens_output: Output tokens
            metadata: Additional metadata

        Returns:
            Cost in USD
        """
        cost = self._calculate_cost(model, tokens_input, tokens_output)

        record = CostRecord(
            timestamp=datetime.utcnow(),
            workflow_id=workflow_id,
            execution_id=execution_id,
            node_id=node_id,
            service='llm',
            model=model,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            cost_usd=cost,
            metadata=metadata or {}
        )

        self.records.append(record)

        logger.info(
            f"Recorded LLM cost: ${cost:.4f} - "
            f"model={model}, tokens={tokens_input}/{tokens_output}"
        )

        return cost

    def _calculate_cost(
        self,
        model: str,
        tokens_input: int,
        tokens_output: int
    ) -> float:
        """
        Calculate cost for an LLM call.

        Args:
            model: Model name
            tokens_input: Input tokens
            tokens_output: Output tokens

        Returns:
            Cost in USD
        """
        if model not in self.pricing:
            logger.warning(f"Unknown model pricing: {model}, using default")
            # Default pricing
            input_cost_per_million = 1.0
            output_cost_per_million = 2.0
        else:
            input_cost_per_million = self.pricing[model]['input']
            output_cost_per_million = self.pricing[model]['output']

        input_cost = (tokens_input / 1_000_000) * input_cost_per_million
        output_cost = (tokens_output / 1_000_000) * output_cost_per_million

        return input_cost + output_cost

    async def get_execution_cost(self, execution_id: int) -> float:
        """
        Get total cost for an execution.

        Args:
            execution_id: Execution ID

        Returns:
            Total cost in USD
        """
        execution_records = [
            r for r in self.records
            if r.execution_id == execution_id
        ]

        return sum(r.cost_usd for r in execution_records)

    async def get_workflow_cost(
        self,
        workflow_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get cost analytics for a workflow.

        Args:
            workflow_id: Workflow ID
            start_time: Optional start time filter
            end_time: Optional end time filter

        Returns:
            Cost analytics dict
        """
        workflow_records = [
            r for r in self.records
            if r.workflow_id == workflow_id
        ]

        if start_time:
            workflow_records = [
                r for r in workflow_records
                if r.timestamp >= start_time
            ]

        if end_time:
            workflow_records = [
                r for r in workflow_records
                if r.timestamp <= end_time
            ]

        if not workflow_records:
            return {
                'total_cost': 0.0,
                'total_calls': 0,
                'total_tokens': 0
            }

        total_cost = sum(r.cost_usd for r in workflow_records)
        total_tokens_input = sum(r.tokens_input for r in workflow_records)
        total_tokens_output = sum(r.tokens_output for r in workflow_records)

        # Group by model
        by_model = defaultdict(lambda: {
            'calls': 0,
            'cost': 0.0,
            'tokens_input': 0,
            'tokens_output': 0
        })

        for record in workflow_records:
            by_model[record.model]['calls'] += 1
            by_model[record.model]['cost'] += record.cost_usd
            by_model[record.model]['tokens_input'] += record.tokens_input
            by_model[record.model]['tokens_output'] += record.tokens_output

        return {
            'total_cost': total_cost,
            'total_calls': len(workflow_records),
            'total_tokens_input': total_tokens_input,
            'total_tokens_output': total_tokens_output,
            'total_tokens': total_tokens_input + total_tokens_output,
            'avg_cost_per_call': total_cost / len(workflow_records),
            'by_model': dict(by_model)
        }

    async def get_user_cost(
        self,
        user_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get cost analytics for a user.

        Args:
            user_id: User ID
            start_time: Optional start time filter
            end_time: Optional end time filter

        Returns:
            Cost analytics dict
        """
        # Filter by user (would need user_id in CostRecord in real impl)
        user_records = self.records.copy()

        if start_time:
            user_records = [r for r in user_records if r.timestamp >= start_time]

        if end_time:
            user_records = [r for r in user_records if r.timestamp <= end_time]

        if not user_records:
            return {
                'total_cost': 0.0,
                'total_calls': 0
            }

        total_cost = sum(r.cost_usd for r in user_records)

        return {
            'total_cost': total_cost,
            'total_calls': len(user_records),
            'avg_cost_per_call': total_cost / len(user_records)
        }

    async def get_daily_costs(
        self,
        days: int = 30,
        workflow_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get daily cost breakdown.

        Args:
            days: Number of days to include
            workflow_id: Optional workflow filter

        Returns:
            List of daily cost data
        """
        start_date = datetime.utcnow() - timedelta(days=days)

        records = [r for r in self.records if r.timestamp >= start_date]

        if workflow_id is not None:
            records = [r for r in records if r.workflow_id == workflow_id]

        # Group by day
        daily = defaultdict(lambda: {
            'cost': 0.0,
            'calls': 0,
            'tokens': 0
        })

        for record in records:
            day = record.timestamp.date()
            daily[day]['cost'] += record.cost_usd
            daily[day]['calls'] += 1
            daily[day]['tokens'] += record.tokens_input + record.tokens_output

        # Convert to list
        result = []
        for day in sorted(daily.keys()):
            result.append({
                'date': day.isoformat(),
                'cost': daily[day]['cost'],
                'calls': daily[day]['calls'],
                'tokens': daily[day]['tokens']
            })

        return result

    async def estimate_cost(
        self,
        model: str,
        estimated_tokens_input: int,
        estimated_tokens_output: int
    ) -> Dict[str, Any]:
        """
        Estimate cost for a future LLM call.

        Args:
            model: Model name
            estimated_tokens_input: Estimated input tokens
            estimated_tokens_output: Estimated output tokens

        Returns:
            Cost estimate dict
        """
        cost = self._calculate_cost(
            model,
            estimated_tokens_input,
            estimated_tokens_output
        )

        return {
            'model': model,
            'estimated_tokens_input': estimated_tokens_input,
            'estimated_tokens_output': estimated_tokens_output,
            'estimated_cost_usd': cost
        }

    async def get_top_expensive_workflows(
        self,
        limit: int = 10,
        start_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get most expensive workflows.

        Args:
            limit: Number of workflows to return
            start_time: Optional time filter

        Returns:
            List of workflows with costs
        """
        records = self.records

        if start_time:
            records = [r for r in records if r.timestamp >= start_time]

        # Group by workflow
        by_workflow = defaultdict(float)

        for record in records:
            by_workflow[record.workflow_id] += record.cost_usd

        # Sort and limit
        sorted_workflows = sorted(
            by_workflow.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]

        return [
            {
                'workflow_id': workflow_id,
                'total_cost': cost
            }
            for workflow_id, cost in sorted_workflows
        ]

    async def set_pricing(self, model: str, input_cost: float, output_cost: float):
        """
        Set pricing for a model.

        Args:
            model: Model name
            input_cost: Cost per 1M input tokens
            output_cost: Cost per 1M output tokens
        """
        self.pricing[model] = {
            'input': input_cost,
            'output': output_cost
        }

        logger.info(f"Updated pricing for {model}")

    async def get_cost_summary(self) -> Dict[str, Any]:
        """
        Get overall cost summary.

        Returns:
            Cost summary dict
        """
        if not self.records:
            return {
                'total_cost': 0.0,
                'total_calls': 0,
                'total_tokens': 0
            }

        total_cost = sum(r.cost_usd for r in self.records)
        total_tokens = sum(
            r.tokens_input + r.tokens_output for r in self.records
        )

        # Last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_records = [r for r in self.records if r.timestamp >= thirty_days_ago]
        recent_cost = sum(r.cost_usd for r in recent_records)

        return {
            'total_cost': total_cost,
            'total_calls': len(self.records),
            'total_tokens': total_tokens,
            'cost_last_30_days': recent_cost,
            'calls_last_30_days': len(recent_records),
            'avg_cost_per_call': total_cost / len(self.records)
        }
