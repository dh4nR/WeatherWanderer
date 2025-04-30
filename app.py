from flask import Flask, jsonify, request
from models import db, SearchHistory
import logging
import requests
import os

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key-for-development")

# Configure the database
database_url = os.environ.get("DATABASE_URL", "")
database_url = database_url.replace("postgres://", "postgresql://")
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the database with the app
db.init_app(app)

@app.route('/api/health')
def health_check():
    """API health check endpoint"""
    return jsonify({
        "status": "healthy",
        "message": "Weather Rankings API is operational"
    })

@app.route('/api/rankings', methods=['POST'])
def get_rankings():
    """Get activity rankings for a city"""
    try:
        data = request.get_json()
        city = data.get('city')

        if not city:
            return jsonify({'error': 'City name is required'}), 400

        # Get coordinates
        lat, lon = get_coordinates(city)

        # Get weather data
        weather_data = get_weather(lat, lon)

        # Calculate rankings
        rankings = calculate_activity_scores(weather_data)

        # Save search history
        save_search_history(city, rankings)

        return jsonify({
            'city': city,
            'coordinates': {'latitude': lat, 'longitude': lon},
            'rankings': rankings
        })

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/api/history')
def get_history():
    """Get recent search history"""
    try:
        history = SearchHistory.query.order_by(
            SearchHistory.searched_at.desc()
        ).limit(10).all()
        return jsonify({
            'history': [item.to_dict() for item in history]
        })
    except Exception as e:
        logger.error(f"Error retrieving history: {str(e)}")
        return jsonify({'error': 'Error retrieving search history'}), 500

def get_coordinates(city):
    """Get city coordinates from Open-Meteo geocoding API"""
    geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1"
    response = requests.get(geo_url)
    response.raise_for_status()
    data = response.json()

    if "results" not in data or not data["results"]:
        raise ValueError(f"City '{city}' not found")

    result = data["results"][0]
    return result["latitude"], result["longitude"]

def get_weather(lat, lon):
    """Get weather forecast from Open-Meteo API"""
    weather_url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum"
        f"&timezone=auto"
    )
    response = requests.get(weather_url)
    response.raise_for_status()
    return response.json()

def calculate_activity_scores(weather_data):
    """Calculate activity scores based on weather conditions"""
    days = len(weather_data["daily"]["time"])
    scores = {
        "Skiing": 0,
        "Surfing": 0, 
        "Outdoor Sightseeing": 0,
        "Indoor Sightseeing": 0
    }

    for i in range(days):
        temp_max = float(weather_data["daily"]["temperature_2m_max"][i])
        temp_min = float(weather_data["daily"]["temperature_2m_min"][i])
        precip = float(weather_data["daily"]["precipitation_sum"][i])
        snow = float(weather_data["daily"]["snowfall_sum"][i])

        # Calculate daily scores
        if snow > 0 and temp_max <= 2:
            scores["Skiing"] += min(10, snow * 2)

        if 15 <= temp_max <= 30 and precip < 2:
            scores["Surfing"] += max(0, 10 - abs(22.5 - temp_max) * 0.7)

        if precip < 5:
            scores["Outdoor Sightseeing"] += max(0, 10 - abs(20 - temp_max) * 0.7)

        if precip >= 5 or temp_max > 32 or temp_max < 5:
            scores["Indoor Sightseeing"] += min(10, 7 + min(3, precip / 5))

    # Normalize scores
    max_possible = 10 * days
    return [
        {"activity": activity, "score": round((score / max_possible) * 10, 1)}
        for activity, score in sorted(scores.items(), key=lambda x: x[1], reverse=True)
    ]

def save_search_history(city, rankings):
    """Save search results to database"""
    scores = {r["activity"]: r["score"] for r in rankings}
    history = SearchHistory(
        city=city,
        skiing_score=scores.get("Skiing", 0),
        surfing_score=scores.get("Surfing", 0),
        outdoor_sightseeing_score=scores.get("Outdoor Sightseeing", 0),
        indoor_sightseeing_score=scores.get("Indoor Sightseeing", 0)
    )
    db.session.add(history)
    db.session.commit()

@app.route('/')
def index():
    """Render the main page"""
    # Get recent search history (last 10)
    try:
        search_history = SearchHistory.query.order_by(SearchHistory.searched_at.desc()).limit(10).all()
    except Exception as e:
        logger.error(f"Error retrieving search history: {str(e)}")
        search_history = []

    return render_template('index.html', search_history=search_history)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)