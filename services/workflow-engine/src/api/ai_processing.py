"""
AI Processing API endpoints for OpenAI-powered data analysis and processing
Handles generic data processing, model management, and AI-powered insights
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging
import openai
import json
import os
from datetime import datetime

from ..auth import get_current_user, AuthUser
from ..database import get_db

router = APIRouter(prefix="/api/v1/ai", tags=["ai-processing"])
logger = logging.getLogger(__name__)

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY not found in environment variables")
    
openai.api_key = OPENAI_API_KEY

# AI Model Configuration
AI_MODELS = {
    "gpt-4o-mini": {
        "name": "GPT-4o Mini",
        "description": "Fast and cost-effective model for data analysis",
        "cost_per_1k_tokens": 0.00015,
        "max_tokens": 128000,
        "recommended_for": ["data_processing", "quick_analysis", "summaries"]
    },
    "gpt-4o": {
        "name": "GPT-4o",
        "description": "More powerful model for complex analysis",
        "cost_per_1k_tokens": 0.0025,
        "max_tokens": 128000,
        "recommended_for": ["complex_analysis", "detailed_insights", "advanced_reasoning"]
    }
}

DEFAULT_AI_MODEL = "gpt-4o-mini"

def create_ai_system_message() -> str:
    """Create system message for AI data processing"""
    return """You are a data analysis expert. Your role is to analyze structured data and provide insights based on user instructions.

Key guidelines:
1. Analyze the provided data carefully and thoroughly
2. Follow the user's specific instructions precisely
3. Provide clear, actionable insights
4. Format your response in a structured, readable way
5. If the data has issues, point them out constructively
6. Focus on patterns, trends, anomalies, and key findings
7. Be concise but comprehensive in your analysis

Always respond with valuable insights that help users understand their data better."""

async def call_openai_api(
    messages: List[Dict[str, str]],
    model: str = DEFAULT_AI_MODEL,
    max_tokens: int = 4000,
    temperature: float = 0.3
) -> Dict[str, Any]:
    """
    Call OpenAI API with error handling and token tracking
    """
    try:
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        # Extract response data
        content = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason
        
        # Extract token usage
        tokens_used = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens
        }
        
        # Calculate cost
        cost_per_token = AI_MODELS.get(model, {}).get("cost_per_1k_tokens", 0) / 1000
        estimated_cost = tokens_used["total_tokens"] * cost_per_token
        
        return {
            "content": content,
            "finish_reason": finish_reason,
            "tokens_used": tokens_used,
            "estimated_cost": round(estimated_cost, 6),
            "model": model
        }
        
    except openai.RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="OpenAI rate limit exceeded. Please try again later."
        )
    except openai.AuthenticationError:
        raise HTTPException(
            status_code=401,
            detail="OpenAI API authentication failed. Check API key."
        )
    except openai.APIError as e:
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI API error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"OpenAI API call failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI processing failed: {str(e)}"
        )

@router.get("/models")
async def get_available_models(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get available AI models with their characteristics and costs
    """
    try:
        return {
            "success": True,
            "models": AI_MODELS,
            "default_model": DEFAULT_AI_MODEL
        }
        
    except Exception as e:
        logger.error(f"Error retrieving AI models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process")
async def process_data_with_ai(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Process data using AI with custom prompts and instructions
    """
    try:
        # Validate required fields
        prompt = request_data.get('prompt')
        data = request_data.get('data')
        
        if not prompt:
            raise HTTPException(status_code=400, detail="prompt is required")
        if not data:
            raise HTTPException(status_code=400, detail="data is required")
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="data must be an array")
        
        # Extract optional parameters
        preview_mode = request_data.get('preview', False)
        ai_model = request_data.get('ai_model', DEFAULT_AI_MODEL)
        
        # Validate AI model
        if ai_model not in AI_MODELS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported AI model. Available models: {list(AI_MODELS.keys())}"
            )
        
        # Prepare data for AI processing
        data_sample = data
        if preview_mode and len(data) > 10:
            data_sample = data[:10]  # Limit data for preview
        
        # Create messages for OpenAI
        system_message = create_ai_system_message()
        
        # Format data for AI analysis
        data_text = json.dumps(data_sample, indent=2, ensure_ascii=False)
        if len(data_text) > 10000:  # Limit data size
            data_text = data_text[:10000] + "\n... (data truncated)"
        
        user_message = f"""Please analyze this data according to the following instructions:

User Instructions: {prompt}

Data to analyze:
{data_text}

Data Info:
- Total records: {len(data)}
- Records shown: {len(data_sample)}
- Preview mode: {preview_mode}

Please provide your analysis and insights."""

        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]
        
        # Set token limits based on mode
        max_tokens = 2000 if preview_mode else 4000
        
        # Call OpenAI API
        ai_response = await call_openai_api(
            messages=messages,
            model=ai_model,
            max_tokens=max_tokens,
            temperature=0.3
        )
        
        logger.info(f"User {current_user.user_id} processed {len(data)} records with AI ({ai_response['tokens_used']['total_tokens']} tokens)")
        
        return {
            "success": True,
            "output": ai_response["content"],
            "model_used": ai_response["model"],
            "tokens_used": ai_response["tokens_used"]["total_tokens"],
            "ai_metadata": {
                "model": ai_response["model"],
                "tokens_used": ai_response["tokens_used"],
                "estimated_cost": ai_response["estimated_cost"],
                "finish_reason": ai_response["finish_reason"],
                "preview_mode": preview_mode,
                "records_processed": len(data_sample),
                "total_records": len(data)
            },
            "processed_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI data processing failed for user {current_user.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}")

@router.post("/analyze")
async def analyze_data_structure(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Analyze data structure and suggest processing approaches
    """
    try:
        data = request_data.get('data')
        if not data or not isinstance(data, list):
            raise HTTPException(status_code=400, detail="data array is required")
        
        # Basic data analysis
        analysis = {
            "row_count": len(data),
            "columns": [],
            "data_types": {},
            "sample_data": data[:5] if data else [],
            "suggestions": []
        }
        
        if data:
            # Analyze first row to get column structure
            first_row = data[0] if isinstance(data[0], dict) else {}
            analysis["columns"] = list(first_row.keys()) if first_row else []
            
            # Analyze data types
            for col in analysis["columns"]:
                values = [row.get(col) for row in data[:100] if isinstance(row, dict) and col in row]
                non_null_values = [v for v in values if v is not None and v != '']
                
                if non_null_values:
                    # Determine predominant type
                    type_counts = {}
                    for value in non_null_values[:20]:  # Sample first 20 values
                        value_type = type(value).__name__
                        type_counts[value_type] = type_counts.get(value_type, 0) + 1
                    
                    predominant_type = max(type_counts, key=type_counts.get)
                    analysis["data_types"][col] = {
                        "type": predominant_type,
                        "null_count": len(values) - len(non_null_values),
                        "sample_values": non_null_values[:5]
                    }
        
        # Generate suggestions based on data structure
        if len(analysis["columns"]) > 0:
            analysis["suggestions"].append("Data has structured columns - suitable for statistical analysis")
        
        if len(data) > 100:
            analysis["suggestions"].append("Large dataset - consider sampling for initial analysis")
            
        numeric_columns = [col for col, info in analysis["data_types"].items() 
                          if info["type"] in ["int", "float"]]
        if numeric_columns:
            analysis["suggestions"].append(f"Numeric columns detected ({', '.join(numeric_columns)}) - suitable for mathematical operations")
        
        return {
            "success": True,
            "analysis": analysis
        }
        
    except Exception as e:
        logger.error(f"Data structure analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/summarize")
async def summarize_data(
    request_data: dict,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Generate AI-powered summary of data
    """
    try:
        data = request_data.get('data')
        if not data or not isinstance(data, list):
            raise HTTPException(status_code=400, detail="data array is required")
        
        # Create summary prompt
        prompt = f"""Please provide a concise summary of this dataset:
- Key characteristics and structure
- Notable patterns or trends
- Data quality observations
- Recommended analysis approaches

Keep the summary brief but informative."""
        
        # Use the main process endpoint with summary prompt
        summary_request = {
            "prompt": prompt,
            "data": data,
            "preview": True,  # Use preview mode for summaries
            "ai_model": request_data.get('ai_model', DEFAULT_AI_MODEL)
        }
        
        return await process_data_with_ai(summary_request, current_user)
        
    except Exception as e:
        logger.error(f"Data summarization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usage/stats")
async def get_ai_usage_stats(
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get AI usage statistics (placeholder for future implementation)
    """
    try:
        # This would typically query a database for user's AI usage
        return {
            "success": True,
            "usage_stats": {
                "total_requests": 0,
                "total_tokens": 0,
                "estimated_cost": 0.0,
                "current_month": {
                    "requests": 0,
                    "tokens": 0,
                    "cost": 0.0
                }
            },
            "note": "Usage tracking will be implemented with database integration"
        }
        
    except Exception as e:
        logger.error(f"AI usage stats retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))