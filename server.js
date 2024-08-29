const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
const port = 5000;

// Enable CORS to allow requests from your React app
app.use(cors());
app.use(express.json());

// MySQL Database Connection
const db = mysql.createConnection({
    host: '192.168.27.143',
    user: 'saideep',
    password: 'Lenskart@123',
    database: 'PackingDispatchDB'
  });
  
  db.connect(err => {
    if (err) {
      console.error('Error connecting to the database:', err.stack);
      return;
    }
    console.log('Connected to the MySQL database.');
  });


// API endpoint to handle data entry
app.post('/api/data-entry', async (req, res) => {
  const { skuId, dateOfScan, timestamp, stationId, nexsId } = req.body;
  const query = 'INSERT INTO entries (skuId, dateOfScan, timestamp, stationId, nexsId) VALUES (@skuId, @dateOfScan, @timestamp, @stationId, @nexsId)';

  try {
    await db.request()
      .input('skuId', sql.VarChar, skuId)
      .input('dateOfScan', sql.Date, dateOfScan)
      .input('timestamp', sql.Time, timestamp)
      .input('stationId', sql.VarChar, stationId)
      .input('nexsId', sql.VarChar, nexsId)
      .query(query);

    res.status(200).send('Data inserted successfully');
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).send('Error inserting data');
  }
});

// API endpoint to check for duplicate SKU ID and Station ID
app.get('/api/check-duplicate', async (req, res) => {
  const { skuId, stationId } = req.query;
  const query = 'SELECT COUNT(*) AS count FROM entries WHERE skuId = @skuId AND stationId = @stationId';

  try {
    const result = await db.request()
      .input('skuId', sql.VarChar, skuId)
      .input('stationId', sql.VarChar, stationId)
      .query(query);

    const isDuplicate = result.recordset[0].count > 0;
    res.json({ isDuplicate });
  } catch (err) {
    console.error('Error checking for duplicates:', err);
    res.status(500).send('Error checking for duplicates');
  }
});

// API endpoint to retrieve all data
app.get('/api/data', async (req, res) => {
  const query = 'SELECT * FROM entries';

  try {
    const result = await db.request().query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Error fetching data');
  }
});

// API endpoint to fetch redundant SKUs with the most recent date and timestamp
app.get('/api/redundant-skus', async (req, res) => {
  const query = `
    SELECT skuId, stationId, COUNT(*) as scanCount, MAX(dateOfScan) as mostRecentDate, MAX(timestamp) as mostRecentTimestamp
    FROM entries
    GROUP BY skuId, stationId
    HAVING COUNT(*) > 1;
  `;

  try {
    const result = await db.request().query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching redundant SKUs:', err);
    res.status(500).send('Error fetching redundant SKUs');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
