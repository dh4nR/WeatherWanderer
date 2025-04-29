from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

# Initialize SQLAlchemy without binding it to a specific Flask app
db = SQLAlchemy()

class SearchHistory(db.Model):
    """Model for storing search history of cities and their activity rankings"""
    id = db.Column(db.Integer, primary_key=True)
    city = db.Column(db.String(100), nullable=False)
    searched_at = db.Column(db.DateTime, default=datetime.utcnow)
    skiing_score = db.Column(db.Float)
    surfing_score = db.Column(db.Float)
    outdoor_sightseeing_score = db.Column(db.Float)
    indoor_sightseeing_score = db.Column(db.Float)
    
    def __repr__(self):
        return f"<SearchHistory(city='{self.city}', searched_at='{self.searched_at}')>"
    
    def to_dict(self):
        """Convert the model instance to a dictionary"""
        return {
            'id': self.id,
            'city': self.city,
            'searched_at': self.searched_at.strftime('%Y-%m-%d %H:%M:%S'),
            'skiing_score': self.skiing_score,
            'surfing_score': self.surfing_score,
            'outdoor_sightseeing_score': self.outdoor_sightseeing_score,
            'indoor_sightseeing_score': self.indoor_sightseeing_score
        }