# PlaywrightService Technical Documentation

## Overview

The PlaywrightService provides robust web scraping and CSS selector generation capabilities for the Chatmark sports analytics platform. It uses Playwright with Chromium to load web pages, generate CSS selectors, and extract content for monitoring purposes.

## Architecture

### Core Components

- **PlaywrightService**: Main service class with async context manager support
- **Browser Context**: Manages browser settings including user agent and headers
- **CSS Selector Generation**: Intelligent selector creation for web elements
- **Content Extraction**: Multi-selector content extraction with error handling

### Key Features

1. **Anti-Detection Capabilities**
   - Custom user agent configuration
   - Realistic browser headers
   - Chromium with anti-automation flags disabled

2. **Production Ready**
   - Comprehensive error handling
   - Resource cleanup via async context manager
   - Timeout management
   - Multiple page support

3. **CSS Selector Intelligence**
   - Text-based element finding
   - Attribute-based element matching
   - Robust selector generation with parent context
   - Selector uniqueness validation

## API Reference

### Initialization

```python
# Basic usage
async with PlaywrightService() as service:
    page = await service.load_page('https://example.com')

# Custom user agent
service = PlaywrightService()
await service.initialize(user_agent="Custom Agent/1.0")
```

### Core Methods

#### `load_page(url: str, wait_for_load: bool = True) -> Page`

Loads a webpage and returns the Playwright Page object.

**Parameters:**
- `url`: Target URL to load
- `wait_for_load`: Whether to wait for network idle state

**Returns:** Playwright Page object

**Raises:** Exception for HTTP errors or timeouts

#### `generate_css_selector(element_text: str, element_attributes: Dict = None) -> List[str]`

Generates CSS selectors for finding elements with specific text or attributes.

**Parameters:**
- `element_text`: Text content to search for
- `element_attributes`: Dictionary of attributes to match

**Returns:** List of CSS selector strings

#### `test_selector(selector: str) -> Dict`

Tests a CSS selector and returns information about matched elements.

**Returns:**
```python
{
    'selector': str,
    'count': int,
    'elements': [
        {
            'tag': str,
            'text': str,
            'id': str,
            'classes': List[str],
            'attributes': Dict[str, str]
        }
    ]
}
```

#### `extract_content(selectors: List[Dict[str, str]]) -> Dict[str, str]`

Extracts content using multiple CSS selectors.

**Selector Configuration:**
```python
{
    'selector': '.class-name',      # CSS selector
    'label': 'content_label',       # Result key
    'attribute': 'textContent'      # 'textContent', 'innerHTML', 'href', or custom attribute
}
```

### Utility Functions

#### `scrape_url(url: str, selectors: List[Dict], wait_for_load: bool = True) -> Dict`

Convenience function for one-off scraping tasks.

**Returns:**
```python
{
    'success': bool,
    'url': str,
    'page_info': {
        'title': str,
        'status': int,
        'ready_state': str
    },
    'content': Dict[str, str],
    'selectors_tested': int
}
```

## Configuration

### Environment Settings

The service can be configured via environment variables or initialization parameters:

- **User Agent**: Configurable per instance
- **Viewport**: Set to common resolution (1366x768)
- **Headers**: Anti-detection HTTP headers included
- **Timeouts**: 30s page load, 10s network idle

### Production Configuration

```python
# Production-ready initialization
service = PlaywrightService()
await service.initialize(
    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
)
```

### Browser Arguments

The service launches Chromium with these flags:
- `--no-sandbox`: Required for containerized environments
- `--disable-dev-shm-usage`: Prevents shared memory issues
- `--disable-blink-features=AutomationControlled`: Reduces bot detection

## Error Handling

### Common Exceptions

1. **Page Load Failures**: HTTP errors, timeouts, network issues
2. **Selector Errors**: Invalid CSS selectors or missing elements
3. **Initialization Errors**: Playwright startup failures

### Best Practices

```python
async def robust_scraping():
    try:
        async with PlaywrightService() as service:
            page = await service.load_page(url, wait_for_load=False)
            
            # Generate and test selectors
            selectors = await service.generate_css_selector('target text')
            if not selectors:
                raise ValueError("No selectors found")
            
            # Test before extraction
            for selector in selectors:
                result = await service.test_selector(selector)
                if result['count'] > 0:
                    break
            
            # Extract content
            content = await service.extract_content([
                {'selector': selector, 'label': 'target', 'attribute': 'textContent'}
            ])
            
    except Exception as e:
        logger.error(f"Scraping failed: {e}")
        # Handle error appropriately
```

## Testing

### Test Structure

The service includes comprehensive tests:

1. **Unit Tests**: Mock-based testing of individual methods
2. **Integration Tests**: Real webpage testing with httpbin.org
3. **Production Tests**: ESPN.com and other real-world sites
4. **Error Handling Tests**: Timeout, 404, and failure scenarios

### Running Tests

```bash
# Quick verification test
python tests/test_playwright_service.py --quick

# Full test suite
python -m pytest tests/test_playwright_service.py -v

# Specific test class
python -m pytest tests/test_playwright_service.py::TestPlaywrightProductionReadiness -v
```

### Test Coverage

- ✅ Browser initialization and cleanup
- ✅ Page loading with various URLs
- ✅ User agent configuration
- ✅ CSS selector generation and testing
- ✅ Content extraction workflows
- ✅ Error handling and timeouts
- ✅ Real-world site compatibility (ESPN, httpbin)

## Performance Considerations

### Resource Management

- Always use async context manager for automatic cleanup
- Browser contexts are reused within service instance
- Pages are created per URL load (not reused)

### Memory Usage

- Single browser instance per service
- Pages are closed when loading new URLs
- Context cleanup prevents memory leaks

### Optimization Tips

1. **Batch Operations**: Use single service instance for multiple pages
2. **Selective Loading**: Use `wait_for_load=False` for faster loads
3. **Targeted Selectors**: Generate specific selectors to reduce DOM queries
4. **Error Recovery**: Implement retry logic for network failures

## Security Considerations

### Anti-Detection Features

- Realistic user agent strings
- Standard browser headers
- Disabled automation detection flags
- Common viewport sizes

### Bot Mitigation

While the service includes anti-detection features, some sites may still block automated access. Consider:

- User agent rotation for high-volume scraping
- Request timing and rate limiting
- IP rotation if necessary
- Respecting robots.txt and terms of service

## Troubleshooting

### Common Issues

1. **`'Page' object has no attribute 'set_user_agent'`**
   - **Cause**: Outdated Playwright API usage
   - **Solution**: User agent is now set at browser context level (fixed in current version)

2. **Browser Launch Failures**
   - **Cause**: Missing dependencies or sandbox issues
   - **Solution**: Ensure Playwright browsers are installed: `playwright install chromium`

3. **Timeout Errors**
   - **Cause**: Slow page loads or network issues
   - **Solution**: Increase timeout or use `wait_for_load=False`

4. **Selector Generation Returns Empty**
   - **Cause**: Text not found or dynamic content
   - **Solution**: Wait for elements or use attribute-based selection

### Debug Mode

```python
import logging
logging.getLogger('app.services.playwright_service').setLevel(logging.DEBUG)
```

## Migration Notes

### From Previous Version

The service has been updated to fix the `set_user_agent` error:

**Before (Broken):**
```python
await page.set_user_agent(user_agent)  # ❌ Method doesn't exist
```

**After (Fixed):**
```python
context = await browser.new_context(user_agent=user_agent)  # ✅ Correct API
page = await context.new_page()
```

### Breaking Changes

- User agent is now set during initialization, not per page
- Browser context is created once per service instance
- Custom user agents must be set via `initialize(user_agent=...)`

## Integration with Monitoring System

### Web Monitoring Workflow

1. **Page Analysis**: Load target page and analyze structure
2. **Selector Generation**: Create CSS selectors for target elements
3. **Selector Testing**: Validate selectors return expected elements
4. **Content Extraction**: Extract baseline content
5. **Monitoring**: Periodically re-extract and compare changes

### API Integration

The service integrates with the monitoring API endpoints:

- `/api/v1/css-selector/generate`: Generate selectors for page elements
- `/api/v1/css-selector/test`: Test selector validity
- `/api/v1/monitoring-jobs`: Create monitoring jobs with selectors

## Future Enhancements

### Planned Features

1. **Selector Optimization**: Machine learning for better selector generation
2. **Change Detection**: Built-in content comparison algorithms
3. **Screenshot Capture**: Visual monitoring capabilities
4. **Multi-Browser Support**: Firefox and WebKit options
5. **Performance Metrics**: Page load timing and resource usage

### API Evolution

Future versions may include:
- Streaming content extraction
- Real-time change notifications
- Advanced element interaction (clicks, form filling)
- JavaScript execution for dynamic content

---

*Last updated: 2025-07-22*
*Version: 2.0.0*
*Compatibility: Playwright >= 1.40.0*