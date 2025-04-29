// Global variables for storing activity data and charts
let activityChart = null;
let dailyScoresChart = null;

// DOM elements
document.addEventListener('DOMContentLoaded', function() {
    const cityForm = document.getElementById('city-form');
    const resultsContainer = document.getElementById('results-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const errorAlert = document.getElementById('error-alert');
    
    // Set up form submission
    cityForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const cityInput = document.getElementById('city-input');
        const city = cityInput.value.trim();
        
        if (city) {
            fetchActivityRankings(city);
        }
    });
    
    // Function to fetch activity rankings
    function fetchActivityRankings(city) {
        // Show loading spinner, hide results and errors
        loadingSpinner.classList.remove('d-none');
        resultsContainer.classList.add('d-none');
        errorAlert.classList.add('d-none');
        
        // Make API request to our backend
        fetch('/api/rank', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ city: city })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Something went wrong');
                });
            }
            return response.json();
        })
        .then(data => {
            // Hide loading spinner
            loadingSpinner.classList.add('d-none');
            
            // Display results
            displayResults(data);
            
            // Show results container
            resultsContainer.classList.remove('d-none');
        })
        .catch(error => {
            // Hide loading spinner
            loadingSpinner.classList.add('d-none');
            
            // Show error message
            errorAlert.textContent = error.message;
            errorAlert.classList.remove('d-none');
        });
    }
    
    // Function to display results
    function displayResults(data) {
        // Update city name
        document.getElementById('city-name').textContent = data.city;
        
        // Get and sort rankings
        const rankings = data.rankings;
        
        // Create activity scores chart
        createActivityChart(rankings);
        
        // Create daily scores chart from the daily data
        if (data.rankings[0].daily_data) {
            createDailyScoresChart(data.rankings[0].daily_data);
        }
        
        // Update ranking list
        const rankingsList = document.getElementById('rankings-list');
        rankingsList.innerHTML = '';
        
        rankings.forEach((item, index) => {
            if (item.activity !== 'daily_data') {
                const scorePercentage = item.score * 10; // Convert to percentage (0-100)
                
                const listItem = document.createElement('li');
                listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                
                const activityName = document.createElement('span');
                activityName.textContent = `${index + 1}. ${item.activity}`;
                
                const scoreDisplay = document.createElement('div');
                scoreDisplay.className = 'd-flex align-items-center';
                
                const scoreText = document.createElement('span');
                scoreText.className = 'me-2';
                scoreText.textContent = `${item.score}/10`;
                
                const progressContainer = document.createElement('div');
                progressContainer.className = 'progress flex-grow-1 ms-3';
                progressContainer.style.width = '100px';
                
                const progressBar = document.createElement('div');
                progressBar.className = 'progress-bar';
                progressBar.style.width = `${scorePercentage}%`;
                progressBar.setAttribute('role', 'progressbar');
                progressBar.setAttribute('aria-valuenow', scorePercentage);
                progressBar.setAttribute('aria-valuemin', '0');
                progressBar.setAttribute('aria-valuemax', '100');
                
                // Set progress bar color based on activity
                if (item.activity === 'Skiing') {
                    progressBar.classList.add('bg-info');
                } else if (item.activity === 'Surfing') {
                    progressBar.classList.add('bg-primary');
                } else if (item.activity === 'Outdoor Sightseeing') {
                    progressBar.classList.add('bg-success');
                } else if (item.activity === 'Indoor Sightseeing') {
                    progressBar.classList.add('bg-warning');
                }
                
                progressContainer.appendChild(progressBar);
                scoreDisplay.appendChild(scoreText);
                scoreDisplay.appendChild(progressContainer);
                
                listItem.appendChild(activityName);
                listItem.appendChild(scoreDisplay);
                
                rankingsList.appendChild(listItem);
            }
        });
    }
    
    // Function to create the activity scores chart
    function createActivityChart(rankings) {
        const ctx = document.getElementById('activity-chart').getContext('2d');
        
        // Filter out the daily_data entry
        const chartData = rankings.filter(item => item.activity !== 'daily_data');
        
        // Prepare data
        const labels = chartData.map(item => item.activity);
        const scores = chartData.map(item => item.score);
        const backgroundColors = [
            'rgba(0, 123, 255, 0.7)',    // Blue for Skiing
            'rgba(40, 167, 69, 0.7)',    // Green for Surfing
            'rgba(255, 193, 7, 0.7)',    // Yellow for Outdoor
            'rgba(220, 53, 69, 0.7)'     // Red for Indoor
        ];
        
        // Destroy existing chart if it exists
        if (activityChart) {
            activityChart.destroy();
        }
        
        // Create chart
        activityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Activity Score (out of 10)',
                    data: scores,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        title: {
                            display: true,
                            text: 'Score (0-10)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Activity Scores Comparison',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
    
    // Function to create the daily scores chart
    function createDailyScoresChart(dailyData) {
        const ctx = document.getElementById('daily-chart').getContext('2d');
        
        // Format dates for better display
        const formattedDates = dailyData.days.map(dateStr => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        // Prepare datasets for each activity
        const datasets = [];
        const colors = {
            'Skiing': 'rgba(0, 123, 255, 0.7)',
            'Surfing': 'rgba(40, 167, 69, 0.7)',
            'Outdoor Sightseeing': 'rgba(255, 193, 7, 0.7)',
            'Indoor Sightseeing': 'rgba(220, 53, 69, 0.7)'
        };
        
        for (const activity in dailyData.daily_scores) {
            datasets.push({
                label: activity,
                data: dailyData.daily_scores[activity],
                borderColor: colors[activity].replace('0.7', '1'),
                backgroundColor: colors[activity],
                tension: 0.1,
                fill: false
            });
        }
        
        // Destroy existing chart if it exists
        if (dailyScoresChart) {
            dailyScoresChart.destroy();
        }
        
        // Create chart
        dailyScoresChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        title: {
                            display: true,
                            text: 'Daily Score (0-10)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: '7-Day Activity Score Forecast',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });
    }
});
