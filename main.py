import os
import logging
from flask import Flask, jsonify, render_template, request
import time

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key-for-development")

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize a global db variable but don't configure it yet
db = None

@app.route('/')
def hello():
    """Simple home route to confirm the server is running"""
    return jsonify({
        "status": "ok",
        "message": "City Activity Weather Rankings API is online!"
    })

# Lazy-load the database when it's first needed
def get_db():
    global db
    if db is None:
        try:
            from models import db as models_db
            from flask_sqlalchemy import SQLAlchemy
            
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
            models_db.init_app(app)
            db = models_db
            
            # Create tables if they don't exist
            with app.app_context():
                db.create_all()
                
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing database: {str(e)}")
            return None
    return db

@app.route('/api/status')
def api_status():
    """API endpoint to check if the service is running"""
    return jsonify({
        "status": "operational",
        "database": "ready" if get_db() is not None else "not connected",
        "timestamp": time.time()
    })

# Make the main page accessible through the base URL as well
@app.route('/index')
def index():
    return hello()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
