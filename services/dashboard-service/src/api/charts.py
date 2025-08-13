"""
Chart API Endpoints - FastAPI version

AI-powered chart generation endpoints
Adapted from Flask backend to FastAPI microservice architecture
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel

from ..services.chart_service import ChartService
from ..auth import get_current_user_id


router = APIRouter()


# Pydantic models for request/response
class ChartGenerationRequest(BaseModel):
    data: List[dict]
    chartType: Optional[str] = "bar"
    title: Optional[str] = None
    customPrompt: Optional[str] = None


@router.post("/ai/chart/generate")
async def generate_chart_data(
    request: ChartGenerationRequest,
    current_user_id: int = Depends(get_current_user_id)
):
    """Generate structured chart data from input data using AI"""
    try:
        # Validate input data
        if not request.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Input data is required'
            )
        
        # Validate chart configuration
        config_validation = ChartService.validate_chart_config({
            'chartType': request.chartType
        })
        
        if not config_validation['valid']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=config_validation['error']
            )
        
        # Generate chart data using AI
        result = ChartService.generate_chart_data(
            input_data=request.data,
            chart_type=request.chartType,
            title=request.title,
            custom_prompt=request.customPrompt
        )
        
        if result.get('success'):
            return {
                'success': True,
                'chart_data': result['chart_data'],
                'tokens_used': result.get('tokens_used', 0)
            }
        else:
            return {
                'success': False,
                'error': result.get('error', 'Chart generation failed'),
                'reason': result.get('reason', 'Unknown error')
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error in chart generation: {str(e)}"
        )


@router.get("/ai/chart/types")
async def get_chart_types(
    current_user_id: int = Depends(get_current_user_id)
):
    """Get available chart types"""
    try:
        chart_types = ChartService.get_chart_types()
        
        return {
            'success': True,
            'chart_types': chart_types
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting chart types: {str(e)}"
        )