# City Activity Weather Rankings

A web application that ranks cities for various activities based on 7-day weather forecasts from Open-Meteo.

## Features

- **Activity Ranking**: Evaluates and ranks 4 activities (Skiing, Surfing, Outdoor Sightseeing, Indoor Sightseeing) based on weather forecast data
- **Interactive Charts**: Visual representations of rankings and daily weather forecasts
- **City Map**: Displays the geographical location of the searched city
- **Search History**: Stores previous searches for quick reference
- **Responsive Design**: Optimized for various screen sizes

## Technologies Used

- **Backend**: Flask, SQLAlchemy, PostgreSQL
- **Frontend**: HTML, CSS, JavaScript, Bootstrap
- **APIs**: Open-Meteo API (Weather data), Open-Meteo Geocoding API (Location data)
- **Visualization**: Chart.js (Data visualization), Leaflet.js (Maps)

## How It Works

The application uses weather data to calculate activity scores based on these criteria:

- **Skiing**: Good if snowfall > 0 and max temp ≤ 2°C
- **Surfing**: Good if 15°C ≤ max temp ≤ 30°C and precipitation < 2mm
- **Outdoor Sightseeing**: Good if 15°C ≤ max temp ≤ 25°C and precipitation < 1mm
- **Indoor Sightseeing**: Good if precipitation ≥ 5mm or max temp > 32°C or max temp < 5°C

## Setup and Installation

1. Clone the repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Set up environment variables:
   - `DATABASE_URL`: PostgreSQL database connection string
   - `FLASK_SECRET_KEY`: Secret key for Flask sessions
4. Run the application:
   ```
   gunicorn --bind 0.0.0.0:5000 --reload main:app
   ```

## Credits

- Weather data provided by [Open-Meteo](https://open-meteo.com/)
- Geocoding data provided by [Open-Meteo Geocoding API](https://geocoding-api.open-meteo.com/)