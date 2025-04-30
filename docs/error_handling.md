
# Error Handling Documentation

## API Error Responses

The application handles various types of errors and returns appropriate HTTP status codes and error messages.

### Common Error Codes

- `400 Bad Request`: Invalid input or missing parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Unexpected server errors

### Specific Error Cases

1. **City Not Found**
   - Status: 400
   - Response: `{"error": "City 'CITYNAME' not found"}`
   - Occurs when: The provided city name cannot be found in the geocoding service

2. **Invalid Request Format**
   - Status: 400
   - Response: `{"error": "City name is required"}`
   - Occurs when: POST request to `/api/rankings` is missing the city parameter

3. **Database Errors**
   - Status: 500
   - Response: `{"error": "Error retrieving search history"}`
   - Occurs when: Database operations fail

4. **Weather API Errors**
   - Status: 500
   - Response: `{"error": "Error getting weather data"}`
   - Occurs when: External weather API requests fail

## Error Handling Best Practices

1. All API endpoints are wrapped in try-catch blocks
2. Database operations use error handling with rollback capability
3. External API calls include timeout settings and error handling
4. Errors are logged using the application's logging system

## Example Error Handling

```python
@app.route('/api/rankings', methods=['POST'])
def get_rankings():
    try:
        city = request.get_json().get('city')
        if not city:
            return jsonify({'error': 'City name is required'}), 400
            
        # ... processing ...
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500
```
