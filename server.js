const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csvParser = require('csv-parser');
const mysql = require('mysql');

const app = express();
const port = 5000; // Adjust the port as needed

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

const upload = multer({ dest: 'uploads/' }); 

app.post('/api/upload-csv', upload.single('file'), (req, res) => {
  console.log('File received:', req.file);

  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const filePath = path.join(__dirname, 'uploads', req.file.filename);
  console.log('File path:', filePath);

  const results = [];

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on('data', (row) => {
      console.log('Row data:', row);

      const { name, employeeid, doj, ageing, gender, agency, education, throughput, attendance, stationid, shift } = row;

      results.push({
        name,
        employeeid,
        doj,
        ageing,
        gender,
        agency,
        education,
        throughput,
        attendance: attendance || '0000000000000000000000000000000',
        stationid: stationid || null,
        shift: shift || null
      });
    })
    .on('end', async () => {
      console.log('CSV parsing complete, processing data...');

      try {
        for (let user of results) {
          const { employeeid, name, doj, ageing, gender, agency, education, throughput, attendance, stationid, shift } = user;

          const queryCheck = 'SELECT * FROM Employees WHERE employeeid = ?';
          db.query(queryCheck, [employeeid], (err, existingUser) => {
            if (err) {
              console.error('Error checking user:', err);
              return res.status(500).send('Error checking user');
            }

            if (existingUser.length > 0) {
              console.log(`User with employeeid ${employeeid} already exists. Updating record.`);

              const queryUpdate = `
                UPDATE Employees 
                SET name = ?, doj = ?, ageing = ?, gender = ?, agency = ?, education = ?, throughput = ?, stationid = ?, shift = ?
                WHERE employeeid = ?
              `;
              db.query(queryUpdate, [name, doj, ageing, gender, agency, education, throughput, stationid, shift, employeeid], (err, result) => {
                if (err) {
                  console.error('Error updating user:', err);
                }
              });
            } else {
              console.log(`Adding new user with employeeid ${employeeid}.`);
              const queryInsert = `
                INSERT INTO Employees (name, employeeid, doj, ageing, gender, agency, education, throughput, attendance, stationid, shift)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;
              db.query(queryInsert, [name, employeeid, doj, ageing, gender, agency, education, throughput, attendance, stationid, shift], (err, result) => {
                if (err) {
                  console.error('Error inserting user:', err);
                }
              });
            }
          });
        }

        res.status(200).send('CSV processed successfully');
      } catch (err) {
        console.error('Error processing CSV data:', err);
        res.status(500).send('Error processing CSV data');
      } finally {
        fs.unlinkSync(filePath);
      }
    })
    .on('error', (err) => {
      console.error('Error reading CSV file:', err.stack);
      res.status(500).send('Error reading CSV file');
    });
});
app.get('/api/user/:employeeid', (req, res) => {
  const { employeeid } = req.params;

  const query = 'SELECT * FROM Employees WHERE employeeid = ?';

  db.query(query, [employeeid], (err, result) => {
    if (err) {
      console.error('Error fetching user:', err);
      res.status(500).send('Error fetching user');
    } else if (result.length === 0) {
      res.status(404).send('User not found');
    } else {
      res.status(200).json(result[0]);
    }
  });
});

app.post('/api/update-user', (req, res) => {
  const { employeeid, stationid, shift } = req.body;

  const query = `
    UPDATE Employees
    SET stationid = ?, shift = ?
    WHERE employeeid = ?
  `;

  db.query(query, [stationid, shift, employeeid], (err, result) => {
    if (err) {
      console.error('Error updating user:', err);
      res.status(500).send('Error updating user');
    } else {
      res.status(200).send('User updated successfully');
    }
  });
});

app.delete('/api/remove-user/:employeeid', (req, res) => {
  const { employeeid } = req.params;

  const query = 'DELETE FROM Employees WHERE employeeid = ?';

  db.query(query, [employeeid], (err, result) => {
    if (err) {
      console.error('Error removing user:', err);
      res.status(500).send('Error removing user');
    } else {
      res.status(200).send(`User with employeeid ${employeeid} removed`);
    }
  });
});

app.post('/api/update-attendance', (req, res) => {
  const { employeeid } = req.body;

  const today = new Date().getDate(); 

  const queryGetAttendance = `
    SELECT attendance FROM Employees WHERE employeeid = ?
  `;

  db.query(queryGetAttendance, [employeeid], (err, result) => {
    if (err) {
      console.error('Error fetching attendance:', err);
      return res.status(500).send('Error fetching attendance');
    }

    if (result.length === 0) {
      return res.status(404).send('User not found');
    }

    let attendance = result[0].attendance || '0000000000000000000000000000000';
    attendance = attendance.split('');
    attendance[today - 1] = '1'; 
    attendance = attendance.join('');

    const queryUpdateAttendance = `
      UPDATE Employees
      SET attendance = ?
      WHERE employeeid = ?
    `;

    db.query(queryUpdateAttendance, [attendance, employeeid], (err, result) => {
      if (err) {
        console.error('Error updating attendance:', err);
        return res.status(500).send('Error updating attendance');
      }

      res.status(200).send('Attendance updated successfully');
    });
  });
});

app.post('/api/add-user', (req, res) => {
  const {
    name,
    employeeid,
    gender,
    education,
    stationid = null, 
    shift = null,
    attendance = '0000000000000000000000000000000',
    agency = 'N/A'
  } = req.body;

  const doj = new Date().toISOString().slice(0, 10);
  const ageing = 0; // Default value for ageing
  const throughput = 0; // Default value for throughput

  const queryCheck = 'SELECT * FROM Employees WHERE employeeid = ?';
  db.query(queryCheck, [employeeid], (err, existingUser) => {
    if (err) {
      console.error('Error checking user:', err);
      return res.status(500).send('Error checking user');
    }

    if (existingUser.length > 0) {
      console.log(`User with employeeid ${employeeid} already exists. Updating record.`);

      const queryUpdate = `
        UPDATE Employees 
        SET name = ?, doj = ?, ageing = ?, gender = ?, agency = ?, education = ?, throughput = ?, stationid = ?, shift = ?
        WHERE employeeid = ?
      `;
      db.query(queryUpdate, [name, doj, ageing, gender, agency, education, throughput, stationid, shift, employeeid], (err, result) => {
        if (err) {
          console.error('Error updating user:', err);
          return res.status(500).send('Error updating user');
        }
        res.status(200).send('User updated successfully');
      });
    } else {
      console.log(`Adding new user with employeeid ${employeeid}.`);
      const queryInsert = `
        INSERT INTO Employees (name, employeeid, doj, ageing, gender, agency, education, throughput, attendance, stationid, shift)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(queryInsert, [name, employeeid, doj, ageing, gender, agency, education, throughput, attendance, stationid, shift], (err, result) => {
        if (err) {
          console.error('Error inserting user:', err);
          return res.status(500).send('Error inserting user');
        }
        res.status(200).send('User added successfully');
      });
    }
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
