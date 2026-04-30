require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { runOsintScan } = require('./controllers/osintController');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/osint/scan', runOsintScan);

app.listen(PORT, () => {
    console.log(`QuantumShield Backend running on http://localhost:${PORT}`);
});
