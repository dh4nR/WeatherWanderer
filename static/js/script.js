// Global variables for storing activity data and charts
let activityChart = null;
let dailyScoresChart = null;
let weatherChart = null;
let debounceTimer = null;
let selectedCity = null;

// Register necessary Chart.js plugins
// Note: This is commented out for the time being since we're loading plugins but not using them yet
// Chart.register(ChartDataLabels);

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
    
    // Set up search history buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.search-again-btn')) {
            const btn = e.target.closest('.search-again-btn');
            const city = btn.getAttribute('data-city');
            
            if (city) {
                // Update the input field
                document.getElementById('city-input').value = city;
                
                // Scroll to the top of the page
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                // Fetch data for this city
                fetchActivityRankings(city);
            }
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
        // Update city name in the results
        document.getElementById('city-name').textContent = data.city;
        
        // Get and sort rankings
        const rankings = data.rankings;
        
        // Find daily data entry
        const dailyDataEntry = rankings.find(item => item.activity === 'daily_data');
        
        // Create activity scores chart (excluding the daily data entry)
        createActivityChart(rankings.filter(item => item.activity !== 'daily_data'));
        
        // Create daily scores chart from the daily data
        if (dailyDataEntry && dailyDataEntry.daily_data) {
            createDailyScoresChart(dailyDataEntry.daily_data);
            createWeatherDataChart(dailyDataEntry.daily_data);
        }
        
        // No map initialization needed anymore
        
        // Update ranking list
        const rankingsList = document.getElementById('rankings-list');
        rankingsList.innerHTML = '';
        
        // Filter out the daily data entry for the rankings list
        const activityRankings = rankings.filter(item => item.activity !== 'daily_data');
        
        activityRankings.forEach((item, index) => {
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
        });
    }
    
    // Function to create the activity scores chart
    function createActivityChart(rankings) {
        const ctx = document.getElementById('activity-chart').getContext('2d');
        
        // Already filtered in displayResults, but we'll keep this for safety
        const chartData = rankings.filter(item => item.activity !== 'daily_data');
        
        // Prepare data - sort by score for better visualization
        const sortedData = [...chartData].sort((a, b) => b.score - a.score);
        const labels = sortedData.map(item => item.activity);
        const scores = sortedData.map(item => item.score);
        
        // Map activities to colors
        const colorMap = {
            'Skiing': 'rgba(13, 110, 253, 0.8)',         // Blue
            'Surfing': 'rgba(25, 135, 84, 0.8)',         // Green
            'Outdoor Sightseeing': 'rgba(255, 193, 7, 0.8)', // Yellow
            'Indoor Sightseeing': 'rgba(220, 53, 69, 0.8)'   // Red
        };
        
        // Create colors array based on the actual activities
        const backgroundColors = labels.map(activity => colorMap[activity] || 'rgba(150, 150, 150, 0.8)');
        
        // Destroy existing chart if it exists
        if (activityChart) {
            activityChart.destroy();
        }
        
        // Create chart using horizontal bar for better readability
        activityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Activity Score',
                    data: scores,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                indexAxis: 'y',  // Makes the bar chart horizontal
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 10,
                        grid: {
                            color: 'rgba(200, 200, 200, 0.2)'
                        },
                        ticks: {
                            font: {
                                weight: 'bold'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Score (0-10)',
                            font: {
                                weight: 'bold'
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                weight: 'bold'
                            }
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Activity Suitability Ranking',
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        padding: {
                            bottom: 15
                        }
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Score: ${context.raw}/10`;
                            }
                        }
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
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        });
        
        // Prepare datasets for each activity
        const datasets = [];
        const activityColors = {
            'Skiing': 'rgba(13, 110, 253, 0.8)',
            'Surfing': 'rgba(25, 135, 84, 0.8)',
            'Outdoor Sightseeing': 'rgba(255, 193, 7, 0.8)',
            'Indoor Sightseeing': 'rgba(220, 53, 69, 0.8)'
        };
        
        // Add activity score datasets
        for (const activity in dailyData.daily_scores) {
            datasets.push({
                label: activity,
                data: dailyData.daily_scores[activity],
                borderColor: activityColors[activity].replace('0.8', '1'),
                backgroundColor: activityColors[activity],
                borderWidth: 2,
                tension: 0.2,
                fill: false,
                pointRadius: 4,
                pointHoverRadius: 6
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
                        grid: {
                            color: 'rgba(200, 200, 200, 0.2)'
                        },
                        title: {
                            display: true,
                            text: 'Daily Score (0-10)',
                            font: {
                                weight: 'bold'
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                weight: 'bold'
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: '7-Day Activity Score Forecast',
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        padding: {
                            bottom: 15
                        }
                    },
                    tooltip: {
                        usePointStyle: true,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(1)}/10`;
                            }
                        }
                    }
                }
            }
        });
        
        // Create a second chart for weather data
        createWeatherDataChart(dailyData);
    }
    
    // New function to create weather data chart
    function createWeatherDataChart(dailyData) {
        const ctx = document.getElementById('weather-chart').getContext('2d');
        
        // Format dates for better display
        const formattedDates = dailyData.days.map(dateStr => {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        });
        
        // Prepare temperature data
        const tempMaxData = dailyData.temp_max;
        const tempMinData = dailyData.temp_min;
        const precipitationData = dailyData.precipitation;
        const snowfallData = dailyData.snowfall;
        
        // Destroy existing chart if it exists
        if (window.weatherChart) {
            window.weatherChart.destroy();
        }
        
        // Create chart
        window.weatherChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: formattedDates,
                datasets: [
                    {
                        label: 'Max Temp (°C)',
                        data: tempMaxData,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.8)',
                        borderWidth: 1,
                        type: 'line',
                        yAxisID: 'y',
                        tension: 0.2,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        order: 1
                    },
                    {
                        label: 'Min Temp (°C)',
                        data: tempMinData,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.8)',
                        borderWidth: 1,
                        type: 'line',
                        yAxisID: 'y',
                        tension: 0.2,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        order: 2
                    },
                    {
                        label: 'Precipitation (mm)',
                        data: precipitationData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.8)',
                        borderWidth: 1,
                        yAxisID: 'y1',
                        order: 3,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8,
                        borderRadius: 4
                    },
                    {
                        label: 'Snowfall (cm)',
                        data: snowfallData,
                        borderColor: 'rgba(153, 102, 255, 1)',
                        backgroundColor: 'rgba(153, 102, 255, 0.8)',
                        borderWidth: 1,
                        yAxisID: 'y1',
                        order: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Temperature (°C)',
                            font: {
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(200, 200, 200, 0.2)'
                        }
                    },
                    y1: {
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Precipitation/Snowfall (mm/cm)',
                            font: {
                                weight: 'bold'
                            }
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                weight: 'bold'
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: '7-Day Weather Forecast',
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        padding: {
                            bottom: 15
                        }
                    },
                    tooltip: {
                        usePointStyle: true,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Set up city autocomplete functionality
    const cityInput = document.getElementById('city-input');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const suggestionsList = document.getElementById('suggestions-list');
    
    // Add input event listener for city input field
    cityInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        // Clear any existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        // Hide results if input is empty
        if (!query) {
            autocompleteResults.classList.add('d-none');
            return;
        }
        
        // Debounce input to avoid making too many requests
        debounceTimer = setTimeout(() => {
            if (query.length >= 2) {
                fetchCitySuggestions(query);
            } else {
                autocompleteResults.classList.add('d-none');
            }
        }, 300);
    });
    
    // Handle clicks outside to hide suggestions
    document.addEventListener('click', function(e) {
        if (!cityInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
            autocompleteResults.classList.add('d-none');
        }
    });
    
    // Function to fetch city suggestions
    function fetchCitySuggestions(query) {
        fetch(`/api/cities?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(suggestions => {
                // Clear previous suggestions
                suggestionsList.innerHTML = '';
                
                if (suggestions.length > 0) {
                    // Add each suggestion to the list
                    suggestions.forEach(city => {
                        const item = document.createElement('li');
                        item.className = 'list-group-item suggestion-item';
                        item.textContent = city.display_name;
                        item.dataset.name = city.name;
                        
                        // Handle click on suggestion
                        item.addEventListener('click', function() {
                            cityInput.value = city.display_name;
                            selectedCity = city.name;
                            autocompleteResults.classList.add('d-none');
                            
                            // Fetch data for this city
                            fetchActivityRankings(city.name);
                        });
                        
                        suggestionsList.appendChild(item);
                    });
                    
                    // Show the results container
                    autocompleteResults.classList.remove('d-none');
                } else {
                    // Hide results if no suggestions
                    autocompleteResults.classList.add('d-none');
                }
            })
            .catch(error => {
                console.error('Error fetching city suggestions:', error);
                autocompleteResults.classList.add('d-none');
            });
    }
});
