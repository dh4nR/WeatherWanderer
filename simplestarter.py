from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    """Simple home route to verify the app is running"""
    return jsonify({
        "status": "ok",
        "message": "City Activity Weather Rankings API is online"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)