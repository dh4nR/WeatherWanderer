
from flask import Flask, jsonify, request, render_template
from models import db, SearchHistory
import logging
import requests
import os
from functools import lru_cache
from datetime import datetime, timedelta

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key-for-development")


# Create tables
with app.app_context():
    db.create_all()


# Configure the database
database_url = os.environ.get("DATABASE_URL", "").replace("postgres://", "postgresql://")
app.config.update(
    SQLALCHEMY_DATABASE_URI=database_url,
    SQLALCHEMY_ENGINE_OPTIONS={"pool_recycle": 300, "pool_pre_ping": True},
    SQLALCHEMY_TRACK_MODIFICATIONS=False
)

# Initialize database
db.init_app(app)

@lru_cache(maxsize=100)
def get_coordinates(city):
    """Get city coordinates with caching"""
    geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1"
    try:
        response = requests.get(geo_url, timeout=5)
        response.raise_for_status()
        data = response.json()
        if not data.get("results"):
            raise ValueError(f"City '{city}' not found")
        result = data["results"][0]
        return result["latitude"], result["longitude"]
    except Exception as e:
        logger.error(f"Error getting coordinates: {str(e)}")
        raise

@lru_cache(maxsize=100)
def get_weather(lat, lon):
    """Get weather forecast with caching"""
    weather_url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum"
        f"&timezone=auto"
    )
    try:
        response = requests.get(weather_url, timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error getting weather: {str(e)}")
        raise

def calculate_activity_scores(weather_data):
    """Calculate optimized activity scores"""
    days = len(weather_data["daily"]["time"])
    scores = {activity: 0 for activity in ["Skiing", "Surfing", "Outdoor Sightseeing", "Indoor Sightseeing"]}
    daily = weather_data["daily"]

    for i in range(days):
        temp_max = float(daily["temperature_2m_max"][i])
        temp_min = float(daily["temperature_2m_min"][i])
        precip = float(daily["precipitation_sum"][i])
        snow = float(daily["snowfall_sum"][i])

        if snow > 0 and temp_max <= 2:
            scores["Skiing"] += min(10, snow * 2)
        if 15 <= temp_max <= 30 and precip < 2:
            scores["Surfing"] += max(0, 10 - abs(22.5 - temp_max) * 0.7)
        if precip < 5:
            scores["Outdoor Sightseeing"] += max(0, 10 - abs(20 - temp_max) * 0.7)
        if precip >= 5 or temp_max > 32 or temp_max < 5:
            scores["Indoor Sightseeing"] += min(10, 7 + min(3, precip / 5))

    max_possible = 10 * days
    return [
        {"activity": activity, "score": round((score / max_possible) * 10, 1)}
        for activity, score in sorted(scores.items(), key=lambda x: x[1], reverse=True)
    ]

@app.route('/api/health')
def health_check():
    """API health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.utcnow().isoformat()})

@app.route('/api/rankings', methods=['POST'])
def get_rankings():
    """Get activity rankings for a city"""
    try:
        city = request.get_json().get('city')
        if not city:
            return jsonify({'error': 'City name is required'}), 400

        lat, lon = get_coordinates(city)
        weather_data = get_weather(lat, lon)
        rankings = calculate_activity_scores(weather_data)

        # Save search history asynchronously
        with app.app_context():
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
    """Get recent search history with caching"""
    try:
        history = SearchHistory.query.order_by(
            SearchHistory.searched_at.desc()
        ).limit(10).all()
        return jsonify({'history': [item.to_dict() for item in history]})
    except Exception as e:
        logger.error(f"Error retrieving history: {str(e)}")
        return jsonify({'error': 'Error retrieving search history'}), 500

@app.route('/')
def index():
    """Render the main page"""
    try:
        search_history = SearchHistory.query.order_by(
            SearchHistory.searched_at.desc()
        ).limit(10).all()
    except Exception as e:
        logger.error(f"Error retrieving search history: {str(e)}")
        search_history = []
    
    return render_template('index.html', search_history=search_history)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
