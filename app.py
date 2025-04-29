import os
import logging
import requests
from flask import Flask, render_template, request, jsonify
from models import db, SearchHistory

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key-for-development")

# Configure the database
# Make sure we have a DATABASE_URL
database_url = os.environ.get("DATABASE_URL")
if database_url:
    # Ensure the URL starts with postgresql:// not postgres://
    database_url = database_url.replace("postgres://", "postgresql://")
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    }
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    
    # Initialize the database with the app
    db.init_app(app)
    
    # Create tables
    with app.app_context():
        db.create_all()
else:
    logger.error("DATABASE_URL environment variable not set")
    raise RuntimeError("DATABASE_URL environment variable not set")

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

@app.route('/api/history')
def get_search_history():
    """API endpoint to retrieve search history"""
    try:
        # Get the 20 most recent searches
        search_history = SearchHistory.query.order_by(SearchHistory.searched_at.desc()).limit(20).all()
        
        # Convert to list of dictionaries
        history_list = [item.to_dict() for item in search_history]
        
        return jsonify({'history': history_list})
    
    except Exception as e:
        logger.error(f"Error retrieving search history: {str(e)}")
        return jsonify({'error': 'An error occurred retrieving search history'}), 500

@app.route('/api/rank', methods=['POST'])
def rank_activities():
    """API endpoint to rank activities for a city based on weather data"""
    try:
        data = request.get_json()
        city = data.get('city')
        
        if not city:
            return jsonify({'error': 'City name is required'}), 400
        
        # Get coordinates for the city
        lat, lon = get_coordinates(city)
        
        # Get weather data
        weather_data = get_weather(lat, lon)
        
        # Calculate activity scores and get rankings
        rankings = calculate_activity_scores(weather_data)
        
        # Find the scores for each activity to save to the database
        activity_scores = {}
        for item in rankings:
            if item["activity"] != "daily_data":
                activity_scores[item["activity"]] = item["score"]
        
        # Save search to database
        search_history = SearchHistory(
            city=city,
            skiing_score=activity_scores.get("Skiing", 0),
            surfing_score=activity_scores.get("Surfing", 0),
            outdoor_sightseeing_score=activity_scores.get("Outdoor Sightseeing", 0),
            indoor_sightseeing_score=activity_scores.get("Indoor Sightseeing", 0)
        )
        
        db.session.add(search_history)
        db.session.commit()
        
        # Format response
        response = {
            'city': city,
            'rankings': rankings
        }
        
        return jsonify(response)
    
    except ValueError as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({'error': str(e)}), 400
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

def get_coordinates(city):
    """Get latitude and longitude for a city using Open-Meteo geocoding API"""
    geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1"
    response = requests.get(geo_url)
    response.raise_for_status()
    data = response.json()
    
    if "results" not in data or not data["results"]:
        raise ValueError(f"City '{city}' not found. Please check the spelling and try again.")
    
    result = data["results"][0]
    return result["latitude"], result["longitude"]

def get_weather(lat, lon):
    """Get weather forecast data from Open-Meteo API"""
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
    """
    Calculate activity scores based on weather data.
    
    Scoring criteria:
    - Skiing: Good if snowfall > 0 and max temp <= 2°C
    - Surfing: Good if 15°C <= max temp <= 30°C and precipitation < 2mm
    - Outdoor sightseeing: Good if 15°C <= max temp <= 25°C and precipitation < 1mm
    - Indoor sightseeing: Good if precipitation >= 5mm or max temp > 32°C or max temp < 5°C
    """
    days = len(weather_data["daily"]["time"])
    scores = {
        "Skiing": 0,
        "Surfing": 0,
        "Outdoor Sightseeing": 0,
        "Indoor Sightseeing": 0
    }
    
    # Daily data to be returned for charting
    daily_data = {
        "days": weather_data["daily"]["time"],
        "temp_max": weather_data["daily"]["temperature_2m_max"],
        "temp_min": weather_data["daily"]["temperature_2m_min"],
        "precipitation": weather_data["daily"]["precipitation_sum"],
        "snowfall": weather_data["daily"]["snowfall_sum"],
        "daily_scores": {activity: [0] * days for activity in scores.keys()}
    }
    
    for i in range(days):
        temp_min = weather_data["daily"]["temperature_2m_min"][i]
        temp_max = weather_data["daily"]["temperature_2m_max"][i]
        precipitation = weather_data["daily"]["precipitation_sum"][i]
        snowfall = weather_data["daily"]["snowfall_sum"][i]
        
        # Make sure these are all floats
        temp_min = float(temp_min)
        temp_max = float(temp_max)
        precipitation = float(precipitation)
        snowfall = float(snowfall)
        
        # Initialize activity score for this day
        outdoor_score = 0
        
        # Skiing score (0-10 scale)
        if snowfall > 0 and temp_max <= 2:
            skiing_score = min(10, snowfall * 2)
            scores["Skiing"] += skiing_score
            daily_data["daily_scores"]["Skiing"][i] = skiing_score
        
        # Surfing score (0-10 scale)
        if 15 <= temp_max <= 30 and precipitation < 2:
            # Best surfing conditions around 20-25°C with no rain
            temp_factor = 10 - abs(22.5 - temp_max) * 0.7
            rain_factor = 5 - (precipitation * 2)
            surfing_score = max(0, min(10, temp_factor + rain_factor))
            scores["Surfing"] += surfing_score
            daily_data["daily_scores"]["Surfing"][i] = surfing_score
        
        # Outdoor sightseeing score (0-10 scale)
        if precipitation < 5:  # Still possible but less ideal with some rain
            # Perfect around 20°C with no rain
            temp_factor = 10 - min(10, abs(20 - temp_max) * 0.7)
            rain_factor = 5 - min(5, precipitation * 1.5)
            outdoor_score = max(0, min(10, temp_factor + rain_factor))
            scores["Outdoor Sightseeing"] += outdoor_score
            daily_data["daily_scores"]["Outdoor Sightseeing"][i] = outdoor_score
        
        # Indoor sightseeing score (0-10 scale)
        # Higher score when outdoor activities are less ideal
        if precipitation >= 5 or temp_max > 32 or temp_max < 5:
            base_score = 7  # Base score when weather is bad
            # Additional factors
            if precipitation >= 5:
                rain_bonus = min(3, precipitation / 5)
            else:
                rain_bonus = 0
                
            temp_bonus = 0
            if temp_max > 32:
                temp_bonus = min(3, (temp_max - 32) / 3)
            elif temp_max < 5:
                temp_bonus = min(3, (5 - temp_max) / 3)
                
            indoor_score = min(10, base_score + rain_bonus + temp_bonus)
            scores["Indoor Sightseeing"] += indoor_score
            daily_data["daily_scores"]["Indoor Sightseeing"][i] = indoor_score
        else:
            # Even on nice days, indoor activities have some value
            indoor_score = max(2, 5 - (0.5 * outdoor_score / 10))
            scores["Indoor Sightseeing"] += indoor_score
            daily_data["daily_scores"]["Indoor Sightseeing"][i] = indoor_score
    
    # Normalize scores to make them comparable
    max_possible_score = 10 * days
    for activity in scores:
        scores[activity] = round((scores[activity] / max_possible_score) * 10, 1)
    
    # Create a rankings list in the expected format for the frontend
    rankings = []
    for activity, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
        if activity != "daily_data":
            rankings.append({"activity": activity, "score": score})
    
    # Add the daily data as a separate entry
    rankings.append({"activity": "daily_data", "daily_data": daily_data})
    
    return rankings
