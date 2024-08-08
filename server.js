const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const WebSocket = require('ws');
// load env config
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database');
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Endpoint to fetch all products
app.get('/products', (req, res, next) => {
    const query = 'SELECT * FROM products';
    db.query(query, (err, results) => {
        if (err) {
            console.log(err);
            return next(err);
        } else {
            res.status(200).json(results);
        }
    });
});

app.post('/add-product', upload.single('product-image'), (req, res, next) => {
    const { 'product-name': name, 'product-price': price } = req.body;
    const image = '/images/' + req.file.filename;

    const query = 'INSERT INTO products (name, image, price) VALUES (?, ?, ?)';
    db.query(query, [name, image, price], (err, result) => {
        if (err) {
            return next(err);
        } else {
            res.status(200).json({ id: result.insertId, name, image, price });
        }
    });
});

app.delete('/delete-product/:id', (req, res, next) => {
    const productId = req.params.id;
    const query = 'DELETE FROM products WHERE id = ?';
    
    db.query(query, [productId], (err, result) => {
        if (err) {
            return next(err);
        } else {
            res.status(200).send('Product deleted');
        }
    });
});

app.get('/order-history', (req, res, next) => {
    const query = 'SELECT * FROM orders';
    db.query(query, (err, results) => {
        if (err) {
            return next(err);
        } else {
            res.status(200).json(results);
        }
    });
});

app.post('/submit-order', (req, res, next) => {
    const orderData = req.body;
    const query = 'INSERT INTO orders (items, status) VALUES (?, "new")';
    db.query(query, [orderData.items], (err, result) => {
        if (err) {
            return next(err);
        } else {
            const newOrder = {
                id: result.insertId,
                items: orderData.items,
                status: 'new',
                order_date: new Date()
            };
            broadcastOrder(newOrder);
            res.status(200).send('Order saved');
        }
    });
});

// Endpoint to fetch new orders
app.get('/new-orders', (req, res, next) => {
    const query = 'SELECT * FROM orders WHERE status = "new"';
    db.query(query, (err, results) => {
        if (err) {
            return next(err);
        } else {
            res.status(200).json(results);
        }
    });
});

// Endpoint to mark an order as complete
app.post('/complete-order', (req, res, next) => {
    const { orderId } = req.body;
    console.log('Order completed:', orderId);
    const query = 'UPDATE orders SET status = "complete" WHERE id = ?';
    db.query(query, [orderId], (err, result) => {
        if (err) {
            return next(err);
        } else {
            res.status(200).send('Order completed');
            const selectOrderQuery = 'SELECT * FROM orders WHERE id = ?';
            db.query(selectOrderQuery, [orderId], (err, result) => {
                if (err) {
                    console.log(err);
                } else {
                    const order = result[0];
                    order.notification = true;
                    broadcastOrder(order);
                }
            });
            console.log('Order completed:', orderId);
        }
    });
});

// WebSocket server setup
const wss = new WebSocket.Server({ server: app.listen(process.env.PORT, () => {
    console.log('Server running on port 80');
}) });

wss.on('connection', ws => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));
});

function broadcastOrder(order) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(order));
        }
    });
}

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Perform any necessary cleanup and shutdown the application safely
    process.exit(1); // Optional: exit the process
});