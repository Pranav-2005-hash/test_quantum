require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { runOsintScan } = require('./controllers/osintController');
const { getSystemBattery } = require('./controllers/systemController');
const { 
    getNetworkInfo, 
    transmitPackage, 
    getInbox, 
    acknowledgePackage, 
    clearInbox,
    registerIdentity,
    getIdentity
} = require('./controllers/lanController');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.use(cors());
// Increased body parser limit to 100MB for large 600KB+ PDF/DOCX document transmissions
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// System Battery Telemetry Route
app.get('/api/system/battery', getSystemBattery);

// OSINT Scan Route
app.get('/api/osint/scan', runOsintScan);

// LAN Dual-Node Routes
app.get('/api/network-info', getNetworkInfo);
app.post('/api/transmit', transmitPackage);
app.get('/api/inbox', getInbox);
app.post('/api/inbox/:id/ack', acknowledgePackage);
app.delete('/api/inbox/clear', clearInbox);

// Node PQC Identity Exchange Routes
app.post('/api/identity', registerIdentity);
app.get('/api/identity', getIdentity);

app.listen(PORT, HOST, () => {
    console.log(`=================================================`);
    console.log(`🛡️  QuantumShield PQC LAN Server active`);
    console.log(`📡 Listening on 0.0.0.0:${PORT} (LAN reachable)`);
    console.log(`=================================================`);
});
