const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const path = require('path');
const port = 3000;
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const axios = require('axios');
const { promisify } = require('util');
const cookieParser = require('cookie-parser');
const fs = require('fs');
//const cookie = require('cookie');
const otpGenerator = require('otp-generator');

const connection = mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'M7mad123',
  database: 'db'
});

connection.connect((error) => {
  if (error) {
    console.error('Error connecting to the database:', error);
    return;
  }
  console.log('Connected to the database');
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Serve the static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// Define a route to handle the request for the image
app.get('/image', (req, res) => {
  const imagePath = path.join(__dirname, 'background.jpg'); // Path to your image file

  // Send the image file as the response
  res.sendFile(imagePath);
});
app.get('/sign-in', (req, res) => {
  pram = {
    action: "/load-login"
  }
  res.redirect(`/?pram=${encodeURIComponent(JSON.stringify(pram))}`);
});
app.get('/sign-up', (req, res) => {
  pram = {
    action: "/load-signup"
  }
  res.redirect(`/?pram=${encodeURIComponent(JSON.stringify(pram))}`);
});
app.get('/contact-us', (req, res) => {
  pram = {
    action: "/load-contactus"
  }
  res.redirect(`/?pram=${encodeURIComponent(JSON.stringify(pram))}`);
});
app.get('/sign-out', (req, res) => {
  var rememberedEmail = req.cookies.rememberedEmail;

  if (rememberedEmail) {
    res.clearCookie('rememberedEmail');
  }
  pram = {
    action: "/load-login"
  }
  res.redirect(`/?pram=${encodeURIComponent(JSON.stringify(pram))}`);
});
app.get('/dashboard', (req, res) => {
  var rememberedEmail = req.cookies.rememberedEmail;

  if (rememberedEmail) {
    rememberedEmail = rememberedEmail.replace('%', '@');
    connection.query('SELECT * FROM accounts WHERE email = ?', [rememberedEmail], (error, results) => {
      if (error) {
        console.error('Error retrieving user:', error);
        res.status(500).send('Error occurred while retrieving user');
        return;
      }
      if (results.length === 0) {
        // User does not exist
        res.status(500).send('Invalid email or password');
        return;
      }
      const user = results[0];
      pram = {
        action: "/load-stocks",
        user: user
      }
    });
  } else {
    pram = {
      action: "/load-login"
    }
  }
  res.redirect(`/?pram=${encodeURIComponent(JSON.stringify(pram))}`);
});
// Handle signup form submission
app.post('/signup', (req, res) => {
  const { email, password } = req.body;

  // Check if the email already exists in the database
  connection.query('SELECT * FROM accounts WHERE email = ?', [email], (error, results) => {
    if (error) {
      console.error('Error checking email:', error);
      res.status(500).send('Error occurred while checking email');
      return;
    }

    if (results.length > 0) {
      // Email already exists in the database
      res.send('Email already exists');
      return;
    }

    // Hash the password
    bcrypt.hash(password, 10, (hashError, hashedPassword) => {
      if (hashError) {
        console.error('Error hashing password:', hashError);
        res.status(500).send('Error occurred while hashing password');
        return;
      }
      const otp = otpGenerator.generate(6, { digits: true, upperCase: false, specialChars: false });

      // Add the email, hashed password, and symbols to the database
      connection.query('INSERT INTO accounts (email, password, symbols,otp) VALUES (?, ?, ?, ?)', [email, hashedPassword, 'AAPL,GOOGL,NVDA', otp], (insertError) => {
        if (insertError) {
          console.error('Error adding user:', insertError);
          res.status(500).send('Error occurred while adding user');
          return;
        }

        // Send email
        const transporter = nodemailer.createTransport({
          service: 'Outlook',
          auth: {
            user: 'amstocks0@outlook.com', // Replace with your Outlook email address
            pass: 'AM112233', // Replace with your Outlook password
          },
        });
        const text = '<p style="font-size: 16px; color: #333; line-height: 1.5em;">Thank you for signing up!</p>' +
          '<p style="font-size: 16px; color: #333; line-height: 1.5em;">Your OTP code is: <span style="font-weight: bold; color: #FF0000;">' + otp + '</span></p>';


        const mailOptions = {
          from: 'amstocks0@outlook.com', // Your email address
          to: email, // New user's email address
          subject: 'Signup Confirmation',
          html: text,
        };

        transporter.sendMail(mailOptions, (emailError, info) => {
          if (emailError) {
            console.error('Error sending email:', emailError);
            res.status(500).send('Error occurred while sending email');
            return;
          }

          console.log('Email sent:', info.response);
          // Password is correct
          pram = {
            action: "/load-otp",
          }
          res.json({ redirectUrl: `/?pram=${encodeURIComponent(JSON.stringify(pram))}` });
        });
      });
    });
  });
});

// Handle OTP verification request
app.post('/verify-otp', (req, res) => {
  const { otp } = req.body;

  // Perform OTP verification logic here
  // For example, you can compare the received OTP with the stored OTP in the database

  // Assuming you have a 'accounts' table in your database with a column 'otp'
  connection.query('SELECT * FROM accounts WHERE otp = ?', [otp], (error, results) => {
    if (error) {
      console.error('Error verifying OTP:', error);
      res.status(500).send('Error occurred while verifying OTP');
      return;
    }

    if (results.length > 0) {
      // OTP verification successful
      // You can update the account status or perform any additional actions here
      const user = results[0];
      pram = {
        action: "/load-stocks",
        user: user
      }
      res.json({ redirectUrl: `/?pram=${encodeURIComponent(JSON.stringify(pram))}` });
    } else {
      // OTP verification failed
      res.status(400).send('Invalid OTP');
    }
  });
});
// Handle login form submission
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Retrieve the user with the given email from the database
  connection.query('SELECT * FROM accounts WHERE email = ?', [email], (error, results) => {
    if (error) {
      console.error('Error retrieving user:', error);
      res.status(500).send('Error occurred while retrieving user');
      return;
    }

    if (results.length === 0) {
      // User does not exist
      res.status(500).send('Invalid email or password');
      return;
    }

    const user = results[0];

    // Compare the entered password with the stored hashed password
    bcrypt.compare(password, user.password, (compareError, isMatch) => {
      if (compareError) {
        console.error('Error comparing passwords:', compareError);
        res.status(500).send('Error occurred while comparing passwords');
        return;
      }

      if (!isMatch) {
        // Password is incorrect
        res.status(500).send('Invalid email or password');
        return;
      }
      // Password is correct
      pram = {
        action: "/load-stocks",
        user: user
      }
      res.json({ redirectUrl: `/?pram=${encodeURIComponent(JSON.stringify(pram))}` });
      //res.redirect(`/stocks?user=${encodeURIComponent(JSON.stringify(user))}`);
    });
  });
});


app.put('/api/user', (req, res) => {
  const updatedUserData = req.body; // Assuming request body contains the updated user data
  const updateQuery = 'UPDATE accounts SET symbols = ? WHERE email = ?';
  connection.query(updateQuery, [updatedUserData.symbols, updatedUserData.email], (error, result) => {
    if (error) {
      console.error('Error updating data:', error);
      return;
    }
    console.log('Data updated successfully:', result);
  });

  res.send('User data updated successfully');
});

app.get('/api/user', (req, res) => {
  const userEmail = req.query.email; // Assuming email is passed as a query parameter

  // Assuming you have a database connection named 'connection'
  const selectQuery = 'SELECT * FROM accounts WHERE email = ?';
  connection.query(selectQuery, [userEmail], (error, results) => {
    if (error) {
      console.error('Error retrieving user data:', error);
      res.status(500).json({ error: 'Failed to retrieve user data' });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userData = results[0]; // Assuming email is unique, so only one row is returned
    res.json(userData);
  });
});
// POST route for adding a cookie
app.post('/add-cookie', (req, res) => {
  const { email } = req.body;
  // Set the email as a cookie with an expiration date
  res.cookie('rememberedEmail', email, { maxAge: 30 * 24 * 60 * 60 * 1000 }); // Cookie expires in 30 days
  res.send('Cookie added successfully');
});

// DELETE route for removing the cookie
app.delete('/delete-cookie', (req, res) => {
  res.clearCookie('rememberedEmail');
  res.send('Cookie deleted successfully');
});
// Define a route to handle the contact page request
app.get('/load-contactus', (req, res) => {
  // Read the contents of the contact.html file
  fs.readFile('contactus.html', 'utf8', (err, data) => {
    if (err) {
      // Handle any errors that occur while reading the file
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Send the HTML content of the contact.html file as the response
      res.send(data);
    }
  });
});
app.get('/load-otp', (req, res) => {
  // Read the contents of the contact.html file
  fs.readFile('otp.html', 'utf8', (err, data) => {
    if (err) {
      // Handle any errors that occur while reading the file
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Send the HTML content of the contact.html file as the response
      res.send(data);
    }
  });
});
// Define a route to handle the contact page request
app.get('/load-login', (req, res) => {
  // Read the contents of the contact.html file
  fs.readFile('login.html', 'utf8', (err, data) => {
    if (err) {
      // Handle any errors that occur while reading the file
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Send the HTML content of the contact.html file as the response
      res.send(data);
    }
  });
});

// Define a route to handle the contact page request
app.get('/load-signup', (req, res) => {
  // Read the contents of the contact.html file
  fs.readFile('signup.html', 'utf8', (err, data) => {
    if (err) {
      // Handle any errors that occur while reading the file
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Send the HTML content of the contact.html file as the response
      res.send(data);
    }
  });
});

// Define a route to handle the contact page request
app.get('/load-stocks', (req, res) => {
  // Read the contents of the contact.html file
  fs.readFile('stocks.html', 'utf8', (err, data) => {
    if (err) {
      // Handle any errors that occur while reading the file
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Send the HTML content of the contact.html file as the response
      res.send(data);
    }
  });
});

// Define a route to handle the contact page request
app.get('/load-details', (req, res) => {
  // Read the contents of the contact.html file
  fs.readFile('details.html', 'utf8', (err, data) => {
    if (err) {
      // Handle any errors that occur while reading the file
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Send the HTML content of the contact.html file as the response
      res.send(data);
    }
  });
});

// Define a route to handle the contact page request
app.get('/contact', (req, res) => {
  // Read the contents of the contact.html file
  fs.readFile('contactus.html', 'utf8', (err, data) => {
    if (err) {
      // Handle any errors that occur while reading the file
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Send the HTML content of the contact.html file as the response
      res.send(data);
    }
  });
});
// Serve the contactus.html file for GET request to /contactus route
app.get('/contactus', (req, res) => {
  res.sendFile(path.join(__dirname, 'contactus.html'));
});

// Serve the signup.html file for GET request to /signup route
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

// Serve the login.html file for GET request to /login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve the details.html file for GET request to /details route
app.get('/details', (req, res) => {
  pram = {
    action: "/load-details"
  }
  res.redirect(`/?pram=${encodeURIComponent(JSON.stringify(pram))}`);
});

app.get('/stocks-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'stocks.html'));
});
app.get('/stocks', (req, res) => {
  var rememberedEmail = req.cookies.rememberedEmail;

  if (rememberedEmail) {
    rememberedEmail = rememberedEmail.replace('%', '@');
    connection.query('SELECT * FROM accounts WHERE email = ?', [rememberedEmail], (error, results) => {
      if (error) {
        console.error('Error retrieving user:', error);
        res.status(500).send('Error occurred while retrieving user');
        return;
      }
      if (results.length === 0) {
        // User does not exist
        res.status(500).send('Invalid email or password');
        return;
      }
      const user = results[0];
      //res.json({ redirectUrl: `/stocks-login?user=${encodeURIComponent(JSON.stringify(user))}` });
      res.redirect(`/stocks-login?user=${encodeURIComponent(JSON.stringify(user))}`);
    });
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});



// Handle contact form submission
app.post("/send-email", (req, res) => {
  const { name, email, concern, subject } = req.body;

  // Create a Nodemailer transporter using Outlook SMTP settings
  const transporter = nodemailer.createTransport({
    service: "Outlook",
    secure: false,
    auth: {
      user: "amstocks0@outlook.com", // Replace with your Outlook email address
      pass: "AM112233" // Replace with your Outlook password
    }
  });

  const mailOptions = {
    from: "amstocks0@outlook.com", // Replace with your Outlook email address
    to: email, // Replace with the recipient's email address
    subject: concern,
    text: subject
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.sendStatus(500);
    } else {
      console.log("Email sent: " + info.response);
      res.sendStatus(200);
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

