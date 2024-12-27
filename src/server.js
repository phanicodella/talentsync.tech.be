const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db.config');

// Debug log with absolute path
const routePath = path.join(__dirname, 'routes', 'interview.routes.js');
console.log('Route file path:', routePath);
console.log('Attempting to require routes from:', routePath);

const interviewRoutes = require(routePath);
console.log('Routes required successfully');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes with debug log
console.log('Registering routes...');
app.use('/api/interviews', interviewRoutes);
console.log('Routes registered');

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Test route working' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Registered routes:');
    app._router.stack.forEach(function(r){
        if (r.route && r.route.path){
            console.log(r.route.path);
        }
    });
});