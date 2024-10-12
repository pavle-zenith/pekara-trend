const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const WebSocket = require('ws');
const XLSX = require('xlsx'); // Dodata biblioteka za rad sa Excel fajlovima
// load env config
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// Kreiranje MySQL pool konekcije
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    keepAlive: true
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
    pool.query(query, (err, results) => {
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
    pool.query(query, [name, image, price], (err, result) => {
        if (err) {
            return next(err);
        } else {
            res.status(200).json({ id: result.insertId, name, image, price });
        }
    });
});

app.post('/edit-product/:id', upload.single('edit-product-image'), (req, res, next) => {
    const productId = req.params.id;
    const { 'edit-product-name': name, 'edit-product-price': price } = req.body;

    // Proveravamo validnost unosa
    if (!name || !price || isNaN(price)) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    // Proveravamo da li je korisnik poslao novu sliku ili ne
    let image;
    if (req.file) {
        image = '/images/' + req.file.filename; // Nova slika ako je korisnik dodao novu
    }

    // Kreiramo SQL upit za ažuriranje sa ili bez slike
    let query = 'UPDATE products SET name = ?, price = ?';
    const queryParams = [name, price];

    // Ako postoji nova slika, uključujemo je u upit
    if (image) {
        query += ', image = ?';
        queryParams.push(image);
    }

    query += ' WHERE id = ?';
    queryParams.push(productId);

    // Pokrećemo upit u bazi
    pool.query(query, queryParams, (err, result) => {
        if (err) {
            return next(err); // Greška pri izvršavanju upita
        } else {
            // Ažurirani proizvod koji vraćamo
            const updatedProduct = {
                id: productId,
                name: name,
                price: price,
                image: image || req.body['existing-image'] // Ako nema nove slike, koristimo staru
            };
            res.status(200).json(updatedProduct); // Vraćamo izmenjeni proizvod kao odgovor
        }
    });
});
app.get('/completed-orders', (req, res, next) => {
    const query = 'SELECT * FROM orders WHERE status = "complete" ORDER BY order_date DESC LIMIT 5';
    pool.query(query, (err, results) => {
        if (err) {
            return next(err);
        } else {
            console.log('Results:', results); // Loguj podatke pre nego što ih pošalješ
            res.status(200).json(results); // Sigurni smo da šaljemo JSON
        }
    });
});
app.delete('/delete-product/:id', (req, res, next) => {
    const productId = req.params.id;
    const query = 'DELETE FROM products WHERE id = ?';
    
    pool.query(query, [productId], (err, result) => {
        if (err) {
            return next(err);
        } else {
            res.status(200).send('Product deleted');
        }
    });
});

app.get('/order-history', (req, res, next) => {
    const query = 'SELECT * FROM orders';
    pool.query(query, (err, results) => {
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
    pool.query(query, [orderData.items], (err, result) => {
        if (err) {
            return next(err);
        } else {
            const newOrder = {
                id: result.insertId,
                items: orderData.items,
                status: 'new',
                order_date: new Date(),
                type: 'new-order' // Dodajemo tip poruke
            };
            broadcastOrder(newOrder); // Šaljemo porudžbinu sa novim tipom
            res.status(200).send('Order saved');
        }
    });
});

// Endpoint to fetch new orders
app.get('/new-orders', (req, res, next) => {
    const query = 'SELECT * FROM orders WHERE status = "new"';
    pool.query(query, (err, results) => {
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
    pool.query(query, [orderId], (err, result) => {
        if (err) {
            return next(err);
        } else {
            res.status(200).send('Order completed');
            const selectOrderQuery = 'SELECT * FROM orders WHERE id = ?';
            pool.query(selectOrderQuery, [orderId], (err, result) => {
                if (err) {
                    console.log(err);
                } else {
                    const order = result[0];
                    order.notification = true;
                    
                    // Oznaka za tip poruke (ažuriranje porudžbine)
                    order.type = 'order-update'; 
                    broadcastOrder(order); // Ova poruka se sada šalje sa dodatnim tipom
                }
            });
        }
    });
});

// Endpoint for daily orders report
app.get('/daily-orders', (req, res, next) => {
    // Proveravamo vreme poslednjeg resetovanja izveštaja
    const getLastResetTimeQuery = 'SELECT reset_time FROM report_reset ORDER BY reset_time DESC LIMIT 1';
    
    pool.query(getLastResetTimeQuery, (err, result) => {
        if (err) {
            return next(err);
        }

        const lastResetTime = result.length > 0 ? result[0].reset_time : null;

        if (lastResetTime) {
            // Preuzimamo sve porudžbine koje su napravljene posle poslednjeg resetovanja
            const getOrdersQuery = 'SELECT items FROM orders WHERE order_date >= ? AND status = "complete"';
            pool.query(getOrdersQuery, [lastResetTime], (err, ordersResult) => {
                if (err) {
                    return next(err);
                } else {
                    res.status(200).json(ordersResult);
                }
            });
        } else {
            res.status(200).json([]); // Ako nema resetovanja, vraća prazan izveštaj
        }
    });
});

app.post('/reset-daily-report', (req, res, next) => {
    const query = 'INSERT INTO report_reset (reset_time) VALUES (CURRENT_TIMESTAMP)';

    pool.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err); // Loguj grešku
            return next(err); // Vraća grešku
        } else {
            console.log('Timestamp successfully inserted:', result);
            res.status(200).send('Daily report reset successfully');
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
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1); // Optional: exit the process
});