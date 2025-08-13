"""
Chart Generation API endpoints for AI-powered chart creation
Handles bar charts, line charts, and radar charts with intelligent data processing
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Literal
import logging
import openai
import json
import os
from datetime import datetime
from pydantic import BaseModel

from ..auth import get_current_user, AuthUser
from ..database import get_db

router = APIRouter(prefix="/api/v1/ai/chart", tags=["chart-generation"])
logger = logging.getLogger(__name__)

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai.api_key = OPENAI_API_KEY

# Chart Configuration
SUPPORTED_CHART_TYPES = {
    "bar": {
        "name": "Bar Chart",
        "description": "Compare categories with rectangular bars",
        "best_for": "Categorical comparisons, rankings, frequency distributions",
        "data_requirements": "Categories and corresponding values",
        "example": "Sales by region, product popularity, survey responses"
    },
    "line": {
        "name": "Line Chart", 
        "description": "Show trends over time or continuous data",
        "best_for": "Time series, trends, continuous relationships",
        "data_requirements": "Sequential data points (time/ordered categories)",
        "example": "Stock prices over time, website traffic, temperature changes"
    },
    "radar": {
        "name": "Radar Chart",
        "description": "Multi-dimensional comparison in circular format",
        "best_for": "Comparing multiple metrics, skill assessments, performance analysis",
        "data_requirements": "Multiple numeric metrics for comparison",
        "example": "Employee skills, product features, sports statistics"
    }
}

# JSON Schemas for structured outputs
BAR_CHART_SCHEMA = {
    "type": "object",
    "properties": {
        "labels": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Category labels for x-axis"
        },
        "datasets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string", "description": "Dataset label"},
                    "data": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Numeric values for each category"
                    },
                    "backgroundColor": {"type": "string", "description": "Bar color"},
                    "borderColor": {"type": "string", "description": "Border color"}
                },
                "required": ["label", "data", "backgroundColor"]
            }
        },
        "title": {"type": "string", "description": "Chart title"},
        "yAxisLabel": {"type": "string", "description": "Y-axis label"},
        "xAxisLabel": {"type": "string", "description": "X-axis label"}
    },
    "required": ["labels", "datasets", "title"]
}

LINE_CHART_SCHEMA = {
    "type": "object", 
    "properties": {
        "labels": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Labels for x-axis (time points or categories)"
        },
        "datasets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string", "description": "Line label"},
                    "data": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Y-axis values"
                    },
                    "borderColor": {"type": "string", "description": "Line color"},
                    "backgroundColor": {"type": "string", "description": "Fill color"},
                    "fill": {"type": "boolean", "description": "Whether to fill area under line"}
                },
                "required": ["label", "data", "borderColor"]
            }
        },
        "title": {"type": "string", "description": "Chart title"},
        "yAxisLabel": {"type": "string", "description": "Y-axis label"},
        "xAxisLabel": {"type": "string", "description": "X-axis label"}
    },
    "required": ["labels", "datasets", "title"]
}

RADAR_CHART_SCHEMA = {
    "type": "object",
    "properties": {
        "labels": {
            "type": "array", 
            "items": {"type": "string"},
            "description": "Metric names for radar axes"
        },
        "datasets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string", "description": "Entity being compared"},
                    "data": {
                        "type": "array",
                        "items": {"type": "number"},
                        "description": "Values for each metric (0-100 scale recommended)"
                    },
                    "backgroundColor": {"type": "string", "description": "Fill color"},
                    "borderColor": {"type": "string", "description": "Border color"}
                },
                "required": ["label", "data", "backgroundColor", "borderColor"]
            }
        },
        "title": {"type": "string", "description": "Chart title"},
        "scaleMax": {"type": "number", "description": "Maximum scale value"}
    },
    "required": ["labels", "datasets", "title"]
}

CHART_SCHEMAS = {
    "bar": BAR_CHART_SCHEMA,
    "line": LINE_CHART_SCHEMA, 
    "radar": RADAR_CHART_SCHEMA
}

class ChartGenerationRequest(BaseModel):
    data: List[Dict[str, Any]]
    chartType: Literal["bar", "line", "radar"]
    title: Optional[str] = None
    customPrompt: Optional[str] = None

async def generate_chart_with_ai(
    data: List[Dict[str, Any]],
    chart_type: str,
    title: Optional[str] = None,
    custom_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate chart data using OpenAI with structured output
    """
    try:
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        
        # Prepare data for AI
        data_sample = data[:50] if len(data) > 50 else data  # Limit for API efficiency
        data_json = json.dumps(data_sample, indent=2, ensure_ascii=False)
        
        # Create prompt based on chart type
        chart_info = SUPPORTED_CHART_TYPES[chart_type]
        base_prompt = f"""Create a {chart_info['name']} from the provided data.

Chart Type: {chart_type.upper()}
Purpose: {chart_info['description']}
Best for: {chart_info['best_for']}

Instructions:
1. Analyze the data structure and identify appropriate fields for the chart
2. Create meaningful labels and group data logically
3. Choose appropriate colors (use hex codes)
4. Generate a descriptive title if not provided
5. Ensure data is clean and properly formatted
6. For numerical data, round to 2 decimal places maximum

Data to visualize:
{data_json}
"""

        if custom_prompt:
            base_prompt += f"\n\nAdditional Instructions: {custom_prompt}"
            
        if title:
            base_prompt += f"\n\nUse this title: {title}"

        messages = [
            {
                "role": "system", 
                "content": f"You are a data visualization expert. Create Chart.js compatible {chart_type} chart data from user data. Always follow the exact JSON schema provided."
            },
            {"role": "user", "content": base_prompt}
        ]
        
        # Get schema for this chart type
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": f"{chart_type}_chart_data",
                "schema": CHART_SCHEMAS[chart_type]
            }
        }
        
        # Call OpenAI API with structured output
        response = client.chat.completions.create(
            model="gpt-4o-2024-08-06",  # Required for structured outputs
            messages=messages,
            response_format=response_format,
            temperature=0.3
        )
        
        # Parse the structured response
        chart_data = json.loads(response.choices[0].message.content)
        
        # Add metadata
        result = {
            "chartData": chart_data,
            "chartType": chart_type,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "data_points_used": len(data_sample),
                "total_data_points": len(data),
                "tokens_used": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            }
        }
        
        return result
        
    except openai.APIError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {str(e)}")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Invalid JSON response from AI: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chart generation failed: {str(e)}")

@router.get("/types")
async def get_chart_types(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get available chart types with their descriptions and use cases
    """
    try:
        return {
            "success": True,
            "chart_types": SUPPORTED_CHART_TYPES
        }
        
    except Exception as e:
        logger.error(f"Error retrieving chart types: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
async def generate_chart(
    request: ChartGenerationRequest,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Generate AI-powered chart data from raw data
    """
    try:
        # Validate input
        if not request.data:
            raise HTTPException(status_code=400, detail="data is required")
        
        if request.chartType not in SUPPORTED_CHART_TYPES:
            available = ", ".join(SUPPORTED_CHART_TYPES.keys())
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported chart type. Available types: {available}"
            )
        
        # Generate chart using AI
        result = await generate_chart_with_ai(
            data=request.data,
            chart_type=request.chartType,
            title=request.title,
            custom_prompt=request.customPrompt
        )
        
        logger.info(f"User {current_user.user_id} generated {request.chartType} chart from {len(request.data)} data points")
        
        return {
            "success": True,
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chart generation failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Chart generation failed: {str(e)}")

@router.post("/suggest")
async def suggest_chart_type(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Suggest the best chart type for given data using AI analysis
    """
    try:
        data = request_data.get('data')
        if not data or not isinstance(data, list):
            raise HTTPException(status_code=400, detail="data array is required")
        
        # Analyze data structure
        analysis = {
            "row_count": len(data),
            "columns": [],
            "numeric_columns": [],
            "categorical_columns": [],
            "has_time_series": False
        }
        
        if data and isinstance(data[0], dict):
            analysis["columns"] = list(data[0].keys())
            
            # Analyze each column
            for col in analysis["columns"]:
                sample_values = [row.get(col) for row in data[:20] if isinstance(row, dict)]
                sample_values = [v for v in sample_values if v is not None]
                
                if sample_values:
                    # Check if numeric
                    numeric_count = sum(1 for v in sample_values if isinstance(v, (int, float)))
                    if numeric_count > len(sample_values) * 0.7:  # 70% numeric
                        analysis["numeric_columns"].append(col)
                    else:
                        analysis["categorical_columns"].append(col)
                        
                    # Check for time series patterns
                    if any(keyword in col.lower() for keyword in ['date', 'time', 'year', 'month']):
                        analysis["has_time_series"] = True
        
        # Generate recommendations
        recommendations = []
        
        if analysis["has_time_series"] and analysis["numeric_columns"]:
            recommendations.append({
                "chart_type": "line",
                "confidence": 0.9,
                "reason": "Time series data detected - line charts are ideal for showing trends over time"
            })
        
        if len(analysis["categorical_columns"]) >= 1 and len(analysis["numeric_columns"]) >= 1:
            recommendations.append({
                "chart_type": "bar", 
                "confidence": 0.8,
                "reason": "Categorical and numeric data detected - bar charts are great for comparisons"
            })
        
        if len(analysis["numeric_columns"]) >= 3:
            recommendations.append({
                "chart_type": "radar",
                "confidence": 0.7,
                "reason": "Multiple numeric metrics detected - radar charts can show multi-dimensional comparisons"
            })
        
        # Default recommendation
        if not recommendations:
            recommendations.append({
                "chart_type": "bar",
                "confidence": 0.5,
                "reason": "Bar charts are versatile and work well for most data types"
            })
        
        # Sort by confidence
        recommendations.sort(key=lambda x: x["confidence"], reverse=True)
        
        return {
            "success": True,
            "data_analysis": analysis,
            "recommendations": recommendations,
            "suggested_chart": recommendations[0]["chart_type"]
        }
        
    except Exception as e:
        logger.error(f"Chart type suggestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate")
async def validate_chart_config(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Validate chart configuration and data compatibility
    """
    try:
        chart_type = request_data.get('chartType')
        data = request_data.get('data')
        
        if not chart_type or not data:
            raise HTTPException(status_code=400, detail="chartType and data are required")
        
        if chart_type not in SUPPORTED_CHART_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported chart type: {chart_type}")
        
        validation_result = {
            "valid": True,
            "warnings": [],
            "errors": [],
            "suggestions": []
        }
        
        # Basic validations
        if len(data) == 0:
            validation_result["valid"] = False
            validation_result["errors"].append("Data array is empty")
            
        if len(data) > 1000:
            validation_result["warnings"].append("Large dataset detected - consider sampling for better performance")
        
        # Chart-specific validations
        chart_info = SUPPORTED_CHART_TYPES[chart_type]
        
        if chart_type == "line" and len(data) < 3:
            validation_result["warnings"].append("Line charts work best with at least 3 data points")
            
        if chart_type == "radar" and isinstance(data[0], dict):
            numeric_cols = [k for k, v in data[0].items() if isinstance(v, (int, float))]
            if len(numeric_cols) < 3:
                validation_result["suggestions"].append("Radar charts are most effective with at least 3 numeric metrics")
        
        return {
            "success": True,
            "validation": validation_result,
            "chart_info": chart_info
        }
        
    except Exception as e:
        logger.error(f"Chart validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))