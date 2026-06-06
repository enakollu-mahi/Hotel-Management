const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const nodemailer = require('nodemailer');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hotel-mahi-secret-key-2024';

// MySQL Database Configuration
const dbConfig = require('./mysql-config.js');

// Check if MySQL is available
let mysqlAvailable = false;

// Create MySQL connection pool with error handling
let pool;
try {
  pool = mysql.createPool(dbConfig);
} catch (error) {
  console.log('MySQL connection pool creation failed, running in fallback mode');
  mysqlAvailable = false;
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize MySQL database tables
const initDatabase = async () => {
  try {
    if (!pool) {
      throw new Error('MySQL pool not available');
    }
    const connection = await pool.getConnection();
    mysqlAvailable = true;
    
    // Create database if not exists
    await connection.query('CREATE DATABASE IF NOT EXISTS hotel_mahi');
    await connection.query('USE hotel_mahi');
    
    // Hotel table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS hotels (
        hotel_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        rating DECIMAL(3,1),
        city VARCHAR(100),
        landmark VARCHAR(255),
        street_name VARCHAR(255),
        contact VARCHAR(50)
      )
    `);

    // Rooms table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        room_no VARCHAR(20) PRIMARY KEY,
        hotel_id VARCHAR(50),
        status VARCHAR(20) DEFAULT 'available',
        price DECIMAL(10,2) NOT NULL,
        capacity INT,
        type VARCHAR(50),
        rating DECIMAL(3,1),
        location VARCHAR(255),
        image_url TEXT,
        FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id)
      )
    `);

    // Staff table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS staff (
        staff_id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_no VARCHAR(20),
        email VARCHAR(255),
        salary DECIMAL(10,2),
        hire_date DATE,
        supervisor_id VARCHAR(20),
        role VARCHAR(50),
        skill VARCHAR(255),
        image_url TEXT,
        FOREIGN KEY (supervisor_id) REFERENCES staff(staff_id)
      )
    `);

    // Customer table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        customer_id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone_no VARCHAR(20),
        street VARCHAR(255),
        city VARCHAR(100),
        landmark VARCHAR(255),
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Membership table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS memberships (
        membership_id VARCHAR(50) PRIMARY KEY,
        customer_id VARCHAR(50),
        type VARCHAR(50),
        start_date DATE,
        expire_date DATE,
        no_of_bookings INT DEFAULT 0,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
      )
    `);

    // Vehicle table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS vehicles (
        vehicle_no VARCHAR(20) PRIMARY KEY,
        customer_id VARCHAR(50),
        brand VARCHAR(100),
        model VARCHAR(100),
        color VARCHAR(50),
        type VARCHAR(50),
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
      )
    `);

    // Parking table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS parking (
        parking_id VARCHAR(50) PRIMARY KEY,
        vehicle_no VARCHAR(20),
        time_in TIMESTAMP,
        time_out TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        FOREIGN KEY (vehicle_no) REFERENCES vehicles(vehicle_no)
      )
    `);

    // Services table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS services (
        service_id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        charges DECIMAL(10,2),
        category VARCHAR(100),
        description TEXT,
        image_url TEXT
      )
    `);

    // Removed service assignments and customer service interactions tables

    // Booking table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        booking_id VARCHAR(50) PRIMARY KEY,
        customer_id VARCHAR(50),
        room_no VARCHAR(20),
        checkin_date DATE,
        checkout_date DATE,
        status VARCHAR(20) DEFAULT 'pending',
        no_of_members INT,
        total_amount DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (room_no) REFERENCES rooms(room_no)
      )
    `);

    // Payment table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id VARCHAR(50) PRIMARY KEY,
        booking_id VARCHAR(50),
        amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        mode VARCHAR(50),
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
      )
    `);

    // Booking services junction table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS booking_services (
        booking_id VARCHAR(50),
        service_id VARCHAR(20),
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
        FOREIGN KEY (service_id) REFERENCES services(service_id)
      )
    `);

    // Booking staff assignment
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS booking_staff (
        booking_id VARCHAR(50),
        staff_id VARCHAR(20),
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
      )
    `);

    // Separate Service Bookings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS service_bookings (
        service_booking_id VARCHAR(50) PRIMARY KEY,
        customer_id VARCHAR(50),
        service_id VARCHAR(20),
        booking_date DATE,
        booking_time TIME,
        status VARCHAR(20) DEFAULT 'pending',
        total_amount DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (service_id) REFERENCES services(service_id)
      )
    `);

    // Separate Parking Bookings table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS parking_bookings (
        parking_booking_id VARCHAR(50) PRIMARY KEY,
        customer_id VARCHAR(50),
        vehicle_no VARCHAR(20),
        parking_spot VARCHAR(20),
        booking_date DATE,
        start_time TIME,
        end_time TIME,
        status VARCHAR(20) DEFAULT 'pending',
        total_amount DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (vehicle_no) REFERENCES vehicles(vehicle_no)
      )
    `);

    // Parking Spots table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS parking_spots (
        spot_id VARCHAR(20) PRIMARY KEY,
        location VARCHAR(100),
        type VARCHAR(50),
        status VARCHAR(20) DEFAULT 'available',
        price DECIMAL(10,2) DEFAULT 200
      )
    `);

    connection.release();
    console.log('MySQL database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    console.log('Running in fallback mode without MySQL - using static data');
    mysqlAvailable = false;
  }
};

// Initialize database
initDatabase();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Generate customer ID
const generateCustomerId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `CUST-${timestamp}-${random}`;
};

// Generate booking ID
const generateBookingId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BOOK-${timestamp}-${random}`;
};

// API Routes

// Customer Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone_no, password, street, city, landmark } = req.body;
    
    if (!mysqlAvailable) {
      // Fallback mode - simulate registration
      const customerId = generateCustomerId();
      const token = jwt.sign(
        { customer_id: customerId, email: email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({
        message: 'Customer registered successfully (Demo Mode)',
        customer_id: customerId,
        token: token
      });
      return;
    }
    
    // Check if customer already exists
    const [existing] = await pool.execute('SELECT customer_id FROM customers WHERE email = ?', [email]);
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Customer already exists with this email' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Generate customer ID
    const customerId = generateCustomerId();
    
    // Insert customer
    await pool.execute(
      `INSERT INTO customers (customer_id, name, email, phone_no, street, city, landmark, password_hash) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, name, email, phone_no, street, city, landmark, passwordHash]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { customer_id: customerId, email: email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Customer registered successfully',
      customer_id: customerId,
      token: token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Customer Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!mysqlAvailable) {
      // Fallback mode - simulate login (accept any email/password)
      const customerId = generateCustomerId();
      const token = jwt.sign(
        { customer_id: customerId, email: email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({
        message: 'Login successful (Demo Mode)',
        customer_id: customerId,
        token: token
      });
      return;
    }
    
    const [customers] = await pool.execute('SELECT * FROM customers WHERE email = ?', [email]);
    
    if (customers.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const customer = customers[0];
    const isValidPassword = await bcrypt.compare(password, customer.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { customer_id: customer.customer_id, email: customer.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login successful',
      customer_id: customer.customer_id,
      token: token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get customer profile
app.get('/api/customer/profile', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customer_id;
    
    const [customers] = await pool.execute('SELECT * FROM customers WHERE customer_id = ?', [customerId]);
    
    if (customers.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const customer = customers[0];
    delete customer.password_hash;
    res.json(customer);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update customer profile
app.put('/api/customer/profile', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customer_id;
    const { name, phone_no, street, city, landmark } = req.body;
    
    await pool.execute(
      `UPDATE customers SET name = ?, phone_no = ?, street = ?, city = ?, landmark = ? 
       WHERE customer_id = ?`,
      [name, phone_no, street, city, landmark, customerId]
    );
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get all rooms
app.get('/api/rooms', async (req, res) => {
  try {
    if (!mysqlAvailable) {
      // Return static data when MySQL is not available
      const staticRooms = [
        { room_no: 'R101', hotel_id: 'HM-IND-0001', status: 'available', price: 189, capacity: 2, type: 'Deluxe', rating: 4.7, location: 'East Wing, Level 10', image_url: 'https://images.unsplash.com/photo-1501117716987-c8e4b1bd7a5c?q=80&w=800&auto=format&fit=crop' },
        { room_no: 'R102', hotel_id: 'HM-IND-0001', status: 'booked', price: 329, capacity: 4, type: 'Suite', rating: 4.9, location: 'North Tower, Level 18', image_url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=800&auto=format&fit=crop' },
        { room_no: 'R103', hotel_id: 'HM-IND-0001', status: 'available', price: 239, capacity: 4, type: 'Family', rating: 4.5, location: 'Garden Annex, Level 3', image_url: 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=800&auto=format&fit=crop' },
        { room_no: 'R104', hotel_id: 'HM-IND-0001', status: 'available', price: 129, capacity: 2, type: 'Standard', rating: 4.2, location: 'Main, Level 6', image_url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=800&auto=format&fit=crop' },
        { room_no: 'R105', hotel_id: 'HM-IND-0001', status: 'booked', price: 599, capacity: 2, type: 'Suite', rating: 5.0, location: 'Skyline, Level 30', image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800&auto=format&fit=crop' }
      ];
      return res.json(staticRooms);
    }
    
    if (!pool) throw new Error('Database not available');
    const [rooms] = await pool.execute('SELECT * FROM rooms');
    res.json(rooms);
  } catch (error) {
    console.error('Rooms error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get available rooms
app.get('/api/rooms/available', async (req, res) => {
  try {
    const { checkin_date, checkout_date, capacity } = req.query;
    
    let query = `SELECT * FROM rooms WHERE status = 'available'`;
    const params = [];
    
    if (capacity) {
      query += ` AND capacity >= ?`;
      params.push(capacity);
    }
    
    const [rooms] = await pool.execute(query, params);
    res.json(rooms);
  } catch (error) {
    console.error('Available rooms error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all services
app.get('/api/services', async (req, res) => {
  try {
    if (!mysqlAvailable) {
      // Return static data when MySQL is not available
      const staticServices = [
        { service_id: 'S-food', name: 'In-Room Dining', charges: 25, category: 'Food', description: '24/7 curated menu delivered to your door.', image_url: 'https://picsum.photos/seed/food/800/480' },
        { service_id: 'S-spa', name: 'Spa & Wellness', charges: 49, category: 'Membership', description: 'Access to sauna, pool, and gym.', image_url: 'https://picsum.photos/seed/spa/800/480' },
        { service_id: 'S-parking', name: 'Valet Parking', charges: 200, category: 'Transport', description: 'Secure parking with valet service.', image_url: 'https://picsum.photos/seed/parking/800/480' },
        { service_id: 'S-laundry', name: 'Laundry Service', charges: 15, category: 'Housekeeping', description: 'Professional laundry and dry cleaning.', image_url: 'https://picsum.photos/seed/laundry/800/480' }
      ];
      return res.json(staticServices);
    }
    
    if (!pool) throw new Error('Database not available');
    const [services] = await pool.execute('SELECT * FROM services');
    res.json(services);
  } catch (error) {
    console.error('Services error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all staff
app.get('/api/staff', async (req, res) => {
  try {
    const [staff] = await pool.execute('SELECT * FROM staff');
    res.json(staff);
  } catch (error) {
    console.error('Staff error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create booking
app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customer_id;
    const { room_no, checkin_date, checkout_date, no_of_members, services, staff_id, total_amount } = req.body;
    
    const bookingId = generateBookingId();
    
    await pool.execute(
      `INSERT INTO bookings (booking_id, customer_id, room_no, checkin_date, checkout_date, no_of_members, total_amount) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, customerId, room_no, checkin_date, checkout_date, no_of_members, total_amount]
    );
    
    // Add services to booking
    if (services && services.length > 0) {
      for (const serviceId of services) {
        await pool.execute('INSERT INTO booking_services (booking_id, service_id) VALUES (?, ?)', [bookingId, serviceId]);
      }
    }
    
    // Assign staff to booking
    if (staff_id) {
      await pool.execute('INSERT INTO booking_staff (booking_id, staff_id) VALUES (?, ?)', [bookingId, staff_id]);
    }
    
    // Update room status
    await pool.execute('UPDATE rooms SET status = ? WHERE room_no = ?', ['booked', room_no]);
    
    res.json({
      message: 'Booking created successfully',
      booking_id: bookingId
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get customer bookings
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customer_id;
    
    const [bookings] = await pool.execute(
      `SELECT b.*, r.name as room_name, r.type as room_type, r.price as room_price 
       FROM bookings b 
       JOIN rooms r ON b.room_no = r.room_no 
       WHERE b.customer_id = ? 
       ORDER BY b.created_at DESC`,
      [customerId]
    );
    
    res.json(bookings);
  } catch (error) {
    console.error('Bookings error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create payment
app.post('/api/payments', authenticateToken, async (req, res) => {
  try {
    const { booking_id, amount, mode } = req.body;
    
    const paymentId = uuidv4();
    
    await pool.execute(
      `INSERT INTO payments (payment_id, booking_id, amount, mode, status) 
       VALUES (?, ?, ?, ?, 'completed')`,
      [paymentId, booking_id, amount, mode]
    );
    
    // Update booking status
    await pool.execute('UPDATE bookings SET status = ? WHERE booking_id = ?', ['confirmed', booking_id]);
    
    res.json({
      message: 'Payment processed successfully',
      payment_id: paymentId
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Get membership plans
app.get('/api/membership/plans', (req, res) => {
  const plans = [
    { id: 'M1', name: 'Silver', price: 49, perks: ['5% off rooms', 'Late checkout', 'Welcome drink'] },
    { id: 'M2', name: 'Gold', price: 129, perks: ['10% off rooms', 'Free breakfast', 'Spa access'] },
    { id: 'M3', name: 'Platinum', price: 249, perks: ['15% off rooms', 'Suite upgrades', 'Concierge priority'] }
  ];
  res.json(plans);
});

// Create membership
app.post('/api/membership', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customer_id;
    const { type } = req.body;
    
    const membershipId = uuidv4();
    const startDate = moment().format('YYYY-MM-DD');
    const expireDate = moment().add(1, 'year').format('YYYY-MM-DD');
    
    await pool.execute(
      `INSERT INTO memberships (membership_id, customer_id, type, start_date, expire_date) 
       VALUES (?, ?, ?, ?, ?)`,
      [membershipId, customerId, type, startDate, expireDate]
    );
    
    res.json({
      message: 'Membership created successfully',
      membership_id: membershipId
    });
  } catch (error) {
    console.error('Membership error:', error);
    res.status(500).json({ error: 'Failed to create membership' });
  }
});

// Removed staff-service assignments and customer service interactions API endpoints

// Generate service booking ID
const generateServiceBookingId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `SBOOK-${timestamp}-${random}`;
};

// Generate parking booking ID
const generateParkingBookingId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PBOOK-${timestamp}-${random}`;
};

// Create separate service booking
app.post('/api/service-bookings', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customer_id;
    const { service_id, booking_date, booking_time } = req.body;
    
    if (!mysqlAvailable) {
      // Fallback mode - simulate successful booking
      const staticServices = [
        { service_id: 'S-food', name: 'In-Room Dining', charges: 25, category: 'Food' },
        { service_id: 'S-spa', name: 'Spa & Wellness', charges: 49, category: 'Membership' },
        { service_id: 'S-parking', name: 'Valet Parking', charges: 200, category: 'Transport' },
        { service_id: 'S-laundry', name: 'Laundry Service', charges: 15, category: 'Housekeeping' }
      ];
      
      const service = staticServices.find(s => s.service_id === service_id);
      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }
      
      const serviceBookingId = generateServiceBookingId();
      
      res.json({
        message: 'Service booking created successfully (Demo Mode)',
        service_booking_id: serviceBookingId,
        total_amount: service.charges
      });
      return;
    }
    
    // Get service details
    const [services] = await pool.execute('SELECT * FROM services WHERE service_id = ?', [service_id]);
    if (services.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const service = services[0];
    const serviceBookingId = generateServiceBookingId();
    
    await pool.execute(
      `INSERT INTO service_bookings (service_booking_id, customer_id, service_id, booking_date, booking_time, total_amount) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [serviceBookingId, customerId, service_id, booking_date, booking_time, service.charges]
    );
    
    res.json({
      message: 'Service booking created successfully',
      service_booking_id: serviceBookingId,
      total_amount: service.charges
    });
  } catch (error) {
    console.error('Service booking error:', error);
    res.status(500).json({ error: 'Failed to create service booking' });
  }
});

// Get customer service bookings
app.get('/api/service-bookings', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customer_id;
    
    const [bookings] = await pool.execute(
      `SELECT sb.*, s.name as service_name, s.category, s.charges 
       FROM service_bookings sb 
       JOIN services s ON sb.service_id = s.service_id 
       WHERE sb.customer_id = ? 
       ORDER BY sb.created_at DESC`,
      [customerId]
    );
    
    res.json(bookings);
  } catch (error) {
    console.error('Service bookings error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get parking spots
app.get('/api/parking-spots', async (req, res) => {
  try {
    if (!mysqlAvailable) {
      // Return static data when MySQL is not available
      const staticSpots = [];
      for (let i = 1; i <= 20; i++) {
        const spotId = `P${i.toString().padStart(2, '0')}`;
        const location = i <= 10 ? 'Ground Floor' : 'Basement';
        const type = i <= 5 ? 'Premium' : 'Standard';
        const status = Math.random() > 0.3 ? 'available' : 'booked';
        staticSpots.push({ spot_id: spotId, location, type, status, price: 200 });
      }
      return res.json(staticSpots);
    }
    
    if (!pool) throw new Error('Database not available');
    const [spots] = await pool.execute('SELECT * FROM parking_spots ORDER BY spot_id');
    res.json(spots);
  } catch (error) {
    console.error('Parking spots error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create separate parking booking
app.post('/api/parking-bookings', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customer_id;
    const { vehicle_no, parking_spot, booking_date, start_time, end_time } = req.body;
    
    if (!mysqlAvailable) {
      // Fallback mode - simulate successful booking
      const parkingBookingId = generateParkingBookingId();
      
      res.json({
        message: 'Parking booking created successfully (Demo Mode)',
        parking_booking_id: parkingBookingId,
        total_amount: 200
      });
      return;
    }
    
    // Check if parking spot is available
    const [spots] = await pool.execute('SELECT * FROM parking_spots WHERE spot_id = ? AND status = "available"', [parking_spot]);
    if (spots.length === 0) {
      return res.status(400).json({ error: 'Parking spot not available' });
    }
    
    const spot = spots[0];
    const parkingBookingId = generateParkingBookingId();
    
    await pool.execute(
      `INSERT INTO parking_bookings (parking_booking_id, customer_id, vehicle_no, parking_spot, booking_date, start_time, end_time, total_amount) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [parkingBookingId, customerId, vehicle_no, parking_spot, booking_date, start_time, end_time, spot.price]
    );
    
    // Update parking spot status
    await pool.execute('UPDATE parking_spots SET status = ? WHERE spot_id = ?', ['booked', parking_spot]);
    
    res.json({
      message: 'Parking booking created successfully',
      parking_booking_id: parkingBookingId,
      total_amount: spot.price
    });
  } catch (error) {
    console.error('Parking booking error:', error);
    res.status(500).json({ error: 'Failed to create parking booking' });
  }
});

// Get customer parking bookings
app.get('/api/parking-bookings', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customer_id;
    
    const [bookings] = await pool.execute(
      `SELECT pb.*, ps.location, ps.type as spot_type, ps.price 
       FROM parking_bookings pb 
       JOIN parking_spots ps ON pb.parking_spot = ps.spot_id 
       WHERE pb.customer_id = ? 
       ORDER BY pb.created_at DESC`,
      [customerId]
    );
    
    res.json(bookings);
  } catch (error) {
    console.error('Parking bookings error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Check room availability
app.get('/api/rooms/check-availability', async (req, res) => {
  try {
    const { room_no, checkin_date, checkout_date } = req.query;
    
    if (!mysqlAvailable) {
      // Fallback mode - simulate availability check
      const staticRooms = [
        { room_no: 'R101', status: 'available', price: 189, capacity: 2, type: 'Deluxe', rating: 4.7 },
        { room_no: 'R102', status: 'booked', price: 329, capacity: 4, type: 'Suite', rating: 4.9 },
        { room_no: 'R103', status: 'available', price: 239, capacity: 4, type: 'Family', rating: 4.5 },
        { room_no: 'R104', status: 'available', price: 129, capacity: 2, type: 'Standard', rating: 4.2 },
        { room_no: 'R105', status: 'booked', price: 599, capacity: 2, type: 'Suite', rating: 5.0 }
      ];
      
      const room = staticRooms.find(r => r.room_no === room_no);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      const isAvailable = room.status === 'available';
      
      res.json({
        room_no: room_no,
        available: isAvailable,
        room_details: room,
        conflicts: []
      });
      return;
    }
    
    // Check if room exists and is available
    const [rooms] = await pool.execute('SELECT * FROM rooms WHERE room_no = ?', [room_no]);
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const room = rooms[0];
    
    // Check for conflicting bookings
    const [conflicts] = await pool.execute(
      `SELECT * FROM bookings 
       WHERE room_no = ? 
       AND status IN ('pending', 'confirmed') 
       AND (
         (checkin_date <= ? AND checkout_date > ?) OR
         (checkin_date < ? AND checkout_date >= ?) OR
         (checkin_date >= ? AND checkout_date <= ?)
       )`,
      [room_no, checkin_date, checkin_date, checkout_date, checkout_date, checkin_date, checkout_date]
    );
    
    const isAvailable = room.status === 'available' && conflicts.length === 0;
    
    res.json({
      room_no: room_no,
      available: isAvailable,
      room_details: room,
      conflicts: conflicts
    });
  } catch (error) {
    console.error('Room availability check error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Seed initial data
const seedInitialData = async () => {
  try {
    // Insert hotel
    await pool.execute(`INSERT IGNORE INTO hotels (hotel_id, name, rating, city, landmark, street_name, contact) 
            VALUES ('HM-IND-0001', 'Hotel Mahi', 4.6, 'Indore', 'Near Phoenix Mall', 'Tejaji Nagar', '+91 98765 43210')`);
    
    // Insert rooms
    const rooms = [
      ['R101', 'HM-IND-0001', 'available', 189, 2, 'Deluxe', 4.7, 'East Wing, Level 10', 'https://images.unsplash.com/photo-1501117716987-c8e4b1bd7a5c?q=80&w=800&auto=format&fit=crop'],
      ['R102', 'HM-IND-0001', 'booked', 329, 4, 'Suite', 4.9, 'North Tower, Level 18', 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=800&auto=format&fit=crop'],
      ['R103', 'HM-IND-0001', 'available', 239, 4, 'Family', 4.5, 'Garden Annex, Level 3', 'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=800&auto=format&fit=crop'],
      ['R104', 'HM-IND-0001', 'available', 129, 2, 'Standard', 4.2, 'Main, Level 6', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=800&auto=format&fit=crop'],
      ['R105', 'HM-IND-0001', 'booked', 599, 2, 'Suite', 5.0, 'Skyline, Level 30', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800&auto=format&fit=crop']
    ];
    
    for (const room of rooms) {
      await pool.execute(`INSERT IGNORE INTO rooms (room_no, hotel_id, status, price, capacity, type, rating, location, image_url) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, room);
    }
    
    // Insert staff
    const staff = [
      ['ST001', 'Santhosh', '+91 98765 43210', 'santhosh@hotelmahi.in', 45000, '2023-01-15', null, 'Chef', 'Gourmet Dining', 'assets/staff/santhosh.jpg'],
      ['ST002', 'Pankaj', '+91 98765 43211', 'pankaj@hotelmahi.in', 35000, '2023-02-01', null, 'Concierge', 'City Assistance', 'assets/staff/pankaj.jpg'],
      ['ST003', 'Soumya', '+91 98765 43212', 'soumya@hotelmahi.in', 40000, '2023-01-20', null, 'Spa Therapist', 'Wellness & Massage', 'assets/staff/soumya.jpg'],
      ['ST004', 'Amit', '+91 98765 43213', 'amit@hotelmahi.in', 30000, '2023-02-15', null, 'Housekeeping', 'Room Care', 'assets/staff/amit.jpg']
    ];
    
    for (const member of staff) {
      await pool.execute(`INSERT IGNORE INTO staff (staff_id, name, contact_no, email, salary, hire_date, supervisor_id, role, skill, image_url) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, member);
    }
    
    // Insert services
    const services = [
      ['S-food', 'In-Room Dining', 25, 'Food', '24/7 curated menu delivered to your door.', 'https://picsum.photos/seed/food/800/480'],
      ['S-spa', 'Spa & Wellness', 49, 'Membership', 'Access to sauna, pool, and gym.', 'https://picsum.photos/seed/spa/800/480'],
      ['S-parking', 'Valet Parking', 200, 'Transport', 'Secure parking with valet service.', 'https://picsum.photos/seed/parking/800/480'],
      ['S-laundry', 'Laundry Service', 15, 'Housekeeping', 'Professional laundry and dry cleaning.', 'https://picsum.photos/seed/laundry/800/480']
    ];
    
    for (const service of services) {
      await pool.execute(`INSERT IGNORE INTO services (service_id, name, charges, category, description, image_url) 
              VALUES (?, ?, ?, ?, ?, ?)`, service);
    }
    
    // Removed staff-service assignments seeding
    
    // Insert parking spots
    const parkingSpots = [];
    for (let i = 1; i <= 20; i++) {
      const spotId = `P${i.toString().padStart(2, '0')}`;
      const location = i <= 10 ? 'Ground Floor' : 'Basement';
      const type = i <= 5 ? 'Premium' : 'Standard';
      const status = Math.random() > 0.3 ? 'available' : 'booked';
      parkingSpots.push([spotId, location, type, status, 200]);
    }
    
    for (const spot of parkingSpots) {
      await pool.execute(`INSERT IGNORE INTO parking_spots (spot_id, location, type, status, price) 
              VALUES (?, ?, ?, ?, ?)`, spot);
    }
    
    console.log('Initial data seeded successfully');
  } catch (error) {
    console.error('Error seeding data:', error);
  }
};

// Seed data on startup
setTimeout(async () => {
  await seedInitialData();
}, 1000);

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Hotel Mahi server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});

module.exports = app;
