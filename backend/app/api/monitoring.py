from flask import request, jsonify
from app.api import api_bp
from app.models.monitoring import MonitoringJob, ChangeRecord
from app.models.agent import WorkflowAgent
from app.services.playwright_service import PlaywrightService, scrape_url
from app.auth import auth_required, get_current_user
from app import db
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


@api_bp.route('/monitoring-jobs', methods=['GET'])
@auth_required
def get_monitoring_jobs():
    """Get all monitoring jobs for the current user"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        jobs = MonitoringJob.query.filter_by(user_id=user.user_id).all()
        
        return jsonify({
            'success': True,
            'jobs': [job.to_dict() for job in jobs]
        })
        
    except Exception as e:
        logger.error(f"Error getting monitoring jobs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/monitoring-jobs', methods=['POST'])
@auth_required
def create_monitoring_job():
    """Create a new monitoring job"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        required_fields = ['agent_id', 'name', 'url', 'selectors']
        
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing field: {field}'}), 400
        
        # Verify agent exists and belongs to user
        agent = WorkflowAgent.query.filter_by(created_by=str(user.user_id)).first()
        
        if not agent:
            return jsonify({'success': False, 'error': 'Agent not found or access denied'}), 404
        
        # Validate URL format
        if not data['url'].startswith(('http://', 'https://')):
            return jsonify({'success': False, 'error': 'Invalid URL format'}), 400
        
        # Validate selectors format
        if not isinstance(data['selectors'], list) or len(data['selectors']) == 0:
            return jsonify({'success': False, 'error': 'Selectors must be a non-empty list'}), 400
        
        for selector in data['selectors']:
            if not isinstance(selector, dict) or 'selector' not in selector:
                return jsonify({'success': False, 'error': 'Each selector must be a dict with selector field'}), 400
        
        # Create monitoring job
        job = MonitoringJob(
            agent_id=data['agent_id'],
            user_id=user.user_id,
            name=data['name'],
            url=data['url'],
            selectors=data['selectors'],
            frequency=data.get('frequency', 3600),  # Default 1 hour
            change_threshold=data.get('change_threshold', 0.1)  # Default 10%
        )
        
        db.session.add(job)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job': job.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating monitoring job: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/monitoring-jobs/<int:job_id>', methods=['GET'])
@auth_required
def get_monitoring_job(job_id):
    """Get a specific monitoring job"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        job = MonitoringJob.query.filter_by(
            id=job_id,
            user_id=user.user_id
        ).first()
        
        if not job:
            return jsonify({'success': False, 'error': 'Monitoring job not found'}), 404
        
        return jsonify({
            'success': True,
            'job': job.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Error getting monitoring job: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/monitoring-jobs/<int:job_id>', methods=['PUT'])
@auth_required
def update_monitoring_job(job_id):
    """Update a monitoring job"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        job = MonitoringJob.query.filter_by(
            id=job_id,
            user_id=user.user_id
        ).first()
        
        if not job:
            return jsonify({'success': False, 'error': 'Monitoring job not found'}), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'name' in data:
            job.name = data['name']
        if 'url' in data:
            if not data['url'].startswith(('http://', 'https://')):
                return jsonify({'success': False, 'error': 'Invalid URL format'}), 400
            job.url = data['url']
        if 'selectors' in data:
            if not isinstance(data['selectors'], list):
                return jsonify({'success': False, 'error': 'Selectors must be a list'}), 400
            job.selectors = data['selectors']
        if 'frequency' in data:
            job.frequency = data['frequency']
        if 'change_threshold' in data:
            job.change_threshold = data['change_threshold']
        if 'is_active' in data:
            job.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job': job.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Error updating monitoring job: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/monitoring-jobs/<int:job_id>', methods=['DELETE'])
@auth_required
def delete_monitoring_job(job_id):
    """Delete a monitoring job"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        job = MonitoringJob.query.filter_by(
            id=job_id,
            user_id=user.user_id
        ).first()
        
        if not job:
            return jsonify({'success': False, 'error': 'Monitoring job not found'}), 404
        
        db.session.delete(job)
        db.session.commit()
        
        return jsonify({'success': True})
        
    except Exception as e:
        logger.error(f"Error deleting monitoring job: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/monitoring-jobs/<int:job_id>/toggle', methods=['POST'])
@auth_required
def toggle_monitoring_job(job_id):
    """Toggle monitoring job active status"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        job = MonitoringJob.query.filter_by(
            id=job_id,
            user_id=user.user_id
        ).first()
        
        if not job:
            return jsonify({'success': False, 'error': 'Monitoring job not found'}), 404
        
        job.is_active = not job.is_active
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job': job.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Error toggling monitoring job: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/monitoring-jobs/<int:job_id>/test', methods=['POST'])
@auth_required
def test_monitoring_job(job_id):
    """Test a monitoring job by running it once"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        job = MonitoringJob.query.filter_by(
            id=job_id,
            user_id=user.user_id
        ).first()
        
        if not job:
            return jsonify({'success': False, 'error': 'Monitoring job not found'}), 404
        
        # Run the scraping test
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                scrape_url(job.url, job.selectors)
            )
            
            return jsonify({
                'success': True,
                'test_result': result
            })
            
        finally:
            loop.close()
        
    except Exception as e:
        logger.error(f"Error testing monitoring job: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/css-selector/generate', methods=['POST'])
@auth_required
def generate_css_selector():
    """Generate CSS selectors for elements on a webpage"""
    try:
        data = request.get_json()
        
        if 'url' not in data:
            return jsonify({'success': False, 'error': 'URL is required'}), 400
        
        url = data['url']
        element_text = data.get('element_text', '')
        element_attributes = data.get('element_attributes', {})
        
        # Validate URL
        if not url.startswith(('http://', 'https://')):
            return jsonify({'success': False, 'error': 'Invalid URL format'}), 400
        
        # Generate selectors using Playwright
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            async def generate_selectors():
                async with PlaywrightService() as service:
                    await service.load_page(url, wait_for_load=True)
                    
                    selectors = await service.generate_css_selector(
                        element_text, element_attributes
                    )
                    
                    # Test each selector
                    tested_selectors = []
                    for selector in selectors[:5]:  # Limit to 5 selectors
                        test_result = await service.test_selector(selector)
                        tested_selectors.append(test_result)
                    
                    page_info = await service.get_page_info()
                    
                    return {
                        'selectors': tested_selectors,
                        'page_info': page_info,
                        'search_criteria': {
                            'text': element_text,
                            'attributes': element_attributes
                        }
                    }
            
            result = loop.run_until_complete(generate_selectors())
            
            return jsonify({
                'success': True,
                'result': result
            })
            
        finally:
            loop.close()
        
    except Exception as e:
        logger.error(f"Error generating CSS selector: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/css-selector/test', methods=['POST'])
@auth_required
def test_css_selector():
    """Test a CSS selector on a webpage"""
    try:
        data = request.get_json()
        
        required_fields = ['url', 'selector']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing field: {field}'}), 400
        
        url = data['url']
        selector = data['selector']
        
        # Validate URL
        if not url.startswith(('http://', 'https://')):
            return jsonify({'success': False, 'error': 'Invalid URL format'}), 400
        
        # Test selector using Playwright
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            async def test_selector():
                async with PlaywrightService() as service:
                    await service.load_page(url, wait_for_load=True)
                    test_result = await service.test_selector(selector)
                    page_info = await service.get_page_info()
                    
                    return {
                        'test_result': test_result,
                        'page_info': page_info
                    }
            
            result = loop.run_until_complete(test_selector())
            
            return jsonify({
                'success': True,
                'result': result
            })
            
        finally:
            loop.close()
        
    except Exception as e:
        logger.error(f"Error testing CSS selector: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/css-selector/extract', methods=['POST'])
@auth_required
def extract_data_preview():
    """Extract data from multiple elements using CSS selectors"""
    try:
        data = request.get_json()
        
        if 'url' not in data:
            return jsonify({'success': False, 'error': 'URL is required'}), 400
        
        if 'selectors' not in data or not isinstance(data['selectors'], list):
            return jsonify({'success': False, 'error': 'Selectors list is required'}), 400
        
        url = data['url']
        selectors = data['selectors']
        
        # Validate URL
        if not url.startswith(('http://', 'https://')):
            return jsonify({'success': False, 'error': 'Invalid URL format'}), 400
        
        # Extract data using Playwright
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            async def extract_data():
                async with PlaywrightService() as service:
                    await service.load_page(url, wait_for_load=True)
                    
                    # Extract data from all matching elements
                    extracted_data = await service.extract_all_content(selectors)
                    
                    # Also get page info
                    page_info = await service.get_page_info()
                    
                    return {
                        'extracted_data': extracted_data,
                        'page_info': page_info,
                        'row_count': len(extracted_data),
                        'selectors_used': len(selectors)
                    }
            
            result = loop.run_until_complete(extract_data())
            
            return jsonify({
                'success': True,
                'result': result
            })
            
        finally:
            loop.close()
        
    except Exception as e:
        logger.error(f"Error extracting data: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/monitoring-jobs/<int:job_id>/changes', methods=['GET'])
@auth_required
def get_job_changes(job_id):
    """Get change history for a monitoring job"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # Verify job ownership
        job = MonitoringJob.query.filter_by(
            id=job_id,
            user_id=user.user_id
        ).first()
        
        if not job:
            return jsonify({'success': False, 'error': 'Monitoring job not found'}), 404
        
        # Get changes with pagination
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        
        changes = ChangeRecord.query.filter_by(
            monitoring_job_id=job_id
        ).order_by(ChangeRecord.detected_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'success': True,
            'changes': [change.to_dict() for change in changes.items],
            'pagination': {
                'page': changes.page,
                'pages': changes.pages,
                'per_page': changes.per_page,
                'total': changes.total
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting job changes: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500