// backend/src/routes/websocket.test.routes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../config/env.config');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/test-token', authMiddleware.authenticateUser, (req, res) => {
    try {
        // Generate a test WebSocket token
        const wsToken = jwt.sign(
            {
                id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                role: req.user.role,
                type: 'websocket',
                timestamp: Date.now()
            },
            config.jwtSecret,
            { expiresIn: '1h' }
        );

        res.json({
            success: true,
            wsToken,
            wsUrl: `${req.protocol === 'https' ? 'wss' : 'ws'}://${req.get('host')}/ws?token=${wsToken}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate WebSocket test token',
            error: error.message
        });
    }
});

router.get('/connection-test.html', (req, res) => {
    // Serve a simple WebSocket test page
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WebSocket Connection Test</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                #messages { 
                    border: 1px solid #ccc; 
                    padding: 10px; 
                    height: 300px; 
                    overflow-y: auto;
                    margin-bottom: 10px;
                }
                .error { color: red; }
                .success { color: green; }
                .info { color: blue; }
            </style>
        </head>
        <body>
            <h2>WebSocket Connection Test</h2>
            <div id="messages"></div>
            <input type="text" id="messageInput" placeholder="Type a message">
            <button onclick="sendMessage()">Send</button>
            <button onclick="connect()">Connect</button>
            <button onclick="disconnect()">Disconnect</button>
            
            <script>
                let ws;
                let messageArea = document.getElementById('messages');
                
                function log(message, type = 'info') {
                    const div = document.createElement('div');
                    div.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
                    div.className = type;
                    messageArea.appendChild(div);
                    messageArea.scrollTop = messageArea.scrollHeight;
                }

                async function connect() {
                    try {
                        // Get test token
                        const response = await fetch('/api/ws/test-token');
                        const data = await response.json();
                        
                        if (!data.success) {
                            throw new Error(data.message);
                        }

                        // Connect to WebSocket
                        ws = new WebSocket(data.wsUrl);
                        
                        ws.onopen = () => {
                            log('Connected to WebSocket server', 'success');
                        };
                        
                        ws.onmessage = (event) => {
                            try {
                                const data = JSON.parse(event.data);
                                log('Received: ' + JSON.stringify(data, null, 2));
                            } catch (e) {
                                log('Received: ' + event.data);
                            }
                        };
                        
                        ws.onerror = (error) => {
                            log('WebSocket error: ' + error.message, 'error');
                        };
                        
                        ws.onclose = (event) => {
                            log(\`Connection closed: \${event.code} - \${event.reason}\`, 'info');
                        };
                    } catch (error) {
                        log('Connection error: ' + error.message, 'error');
                    }
                }

                function disconnect() {
                    if (ws) {
                        ws.close();
                        ws = null;
                    }
                }

                function sendMessage() {
                    if (!ws) {
                        log('Not connected!', 'error');
                        return;
                    }
                    
                    const input = document.getElementById('messageInput');
                    const message = input.value.trim();
                    
                    if (message) {
                        try {
                            ws.send(JSON.stringify({
                                type: 'chat',
                                data: message
                            }));
                            log('Sent: ' + message);
                            input.value = '';
                        } catch (error) {
                            log('Send error: ' + error.message, 'error');
                        }
                    }
                }

                document.getElementById('messageInput').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            </script>
        </body>
        </html>
    `);
});

module.exports = router;
