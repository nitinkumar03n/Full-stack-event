const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto'); // Bas ye ek baar rahega
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Razorpay = require('razorpay');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();



const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;
const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);
if (cloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
}
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ JWT_SECRET .env mein set nahi hai');
    process.exit(1);
}

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Serve the frontend from this same Render web service.
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

// Connect to MongoDB
const DB_URL = process.env.MONGO_URI;
if (!DB_URL) {
    console.error('❌ MONGO_URI .env mein set nahi hai');
    process.exit(1);
}
 mongoose.connect(DB_URL)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch((err) => console.error('❌ MongoDB Connection Error:', err.message));

// Schemas & Models
const userSchema = new mongoose.Schema({ 
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'owner'], default: 'customer' },
    unlockedVehicles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }],
    createdAt: { type: Date, default: Date.now },

});
const User = mongoose.model('User', userSchema);

const vehicleSchema = new mongoose.Schema({
    category: { type: String, required: true, enum: ['car', 'bike', 'cycle'] },
    title: { type: String, required: true },
    price: { type: Number, required: true },
    brand: { type: String, default: '' },
    modelName: { type: String, default: '' },
    mileage: { type: String, default: 'N/A' },
    service: { type: String, default: 'N/A' },
    ownerPhone: { type: String, required: true },
    ownerLocation: { type: String, required: true, lowercase: true, trim: true },
    img: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isAvailable: { type: Boolean, default: true },
    availabilityCheckDueAt: { type: Date, default: null },
    rentConfirmedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});
const Vehicle = mongoose.model('Vehicle', vehicleSchema);

const paymentSchema = new mongoose.Schema({
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    createdAt: { type: Date, default: Date.now }
});
const Payment = mongoose.model('Payment', paymentSchema);
const isValidPhone = (p) => /^[6-9]\d{9}$/.test(p);

// Keep serving any older local uploads; new listing images are stored in Cloudinary.
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
    }
});

function uploadVehicleImage(file) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'rent-connect/vehicles', resource_type: 'image' },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        stream.end(file.buffer);
    });
}

// Authentication Middleware
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required. Please login.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
    }
};

const optionalAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.userId;
        } catch (e) {
            // Ignore invalid token in optional route
        }
    }
    next();
};

// API: Register User
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;
        if (!name || !email || !phone || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        if (!isValidPhone(phone)) {
            return res.status(400).json({ success: false, message: 'Invalid phone number' });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User with this email or phone already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            role: role || 'customer'
        });
        await newUser.save();

        const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                unlockedVehicles: []
            }
        });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});


// API: Login User
app.post('/api/auth/login', async (req, res) => {
    try {
        const { emailOrPhone, password } = req.body;
        if (!emailOrPhone || !password) {
            return res.status(400).json({ success: false, message: 'Email/Phone and Password required' });
        }

        const user = await User.findOne({
            $or: [{ email: emailOrPhone }, { phone: emailOrPhone }]
        });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Account not found. Please register.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid password. Try again.' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: 'Logged in successfully!',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                unlockedVehicles: user.unlockedVehicles || []
            }
        });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// API: Get All Vehicles
app.get('/api/vehicles', optionalAuthMiddleware, async (req, res) => {
    try {
        let userUnlockedList = [];
        if (req.userId) {
            const user = await User.findById(req.userId).select('unlockedVehicles');
            if (user && user.unlockedVehicles) {
                userUnlockedList = user.unlockedVehicles.map(id => id.toString());
            }
        }

        const vehicles = await Vehicle.find({ isAvailable: { $ne: false }, owner: { $ne: null } }).populate('owner', 'name').sort({ createdAt: -1 }).lean();

        const sanitizedVehicles = await Promise.all(vehicles.map(async v => {
            const isUnlocked = userUnlockedList.includes(v._id.toString());
            const isOwner = Boolean(req.userId && v.owner && v.owner._id.toString() === req.userId.toString());
            return {
                id: v._id,
                category: v.category,
                title: v.title,
                price: v.price,
                mileage: v.mileage,
                service: v.service,
                img: v.img,
                ownerName: v.owner?.name || 'Vehicle owner',
                ownerLocation: (isUnlocked || isOwner) ? v.ownerLocation : null,
                ownerPhone: (isUnlocked || isOwner) ? v.ownerPhone : null,
                isUnlocked: isUnlocked || isOwner
            };
        }));

        res.json({ success: true, vehicles: sanitizedVehicles });
    } catch (err) {
        console.error('Fetch Vehicles Error:', err);
        res.status(500).json({ success: false, message: 'Could not fetch vehicles' });
    }
});

// API: Post New Vehicle
app.post('/api/vehicles', authMiddleware, upload.single('vehicleImage'), async (req, res) => {
    try {
        const listingUser = await User.findById(req.userId);
        if (!listingUser || listingUser.role !== 'owner') {
            return res.status(403).json({ success: false, message: 'Owner account se login karke hi vehicle list kar sakte hain.' });
        }
        const {
            category,
            brand,
            model,
            cycleBrand,
            cycleModel,
            mileage,
            service,
            price,
            city,
            phone
        } = req.body;

        if (!['car', 'bike', 'cycle'].includes(category) || !Number.isFinite(Number(price)) || Number(price) <= 0 || !city || !isValidPhone(phone)) {
            return res.status(400).json({ success: false, message: 'Valid category, positive monthly price, city, and 10-digit phone required.' });
        }

        let title = '';
        if (category === 'cycle') {
            title = `${cycleBrand || ''} ${cycleModel || ''}`.trim() || 'Mountain Cycle';
        } else {
            title = `${brand || ''} ${model || ''}`.trim() || `${category.toUpperCase()} Rental`;
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'JPG, PNG, ya WebP vehicle photo upload karo (max 5 MB).' });
        }
        if (!cloudinaryConfigured) {
            return res.status(503).json({ success: false, message: 'Vehicle photo storage configure nahi hai. Cloudinary environment variables set karo.' });
        }

        const imgUrl = await uploadVehicleImage(req.file);

        const newVehicle = new Vehicle({
            category,
            title,
            brand: category === 'cycle' ? cycleBrand : brand,
            modelName: category === 'cycle' ? cycleModel : model,
            price: Number(price),
            mileage: mileage || 'N/A',
            service: service || 'N/A',
            ownerPhone: phone,
            ownerLocation: (city || '').toLowerCase().trim(),
            img: imgUrl,
            owner: req.userId
        });

        await newVehicle.save();

        res.status(201).json({
            success: true,
            message: 'Vehicle listed successfully!',
            vehicle: newVehicle
        });
    } catch (err) {
        console.error('Post Vehicle Error:', err);
        res.status(500).json({ success: false, message: 'Failed to post vehicle.' });
    }
});

// Pricing Rules
const UNLOCK_PRICING = {
    car: 80,
    bike: 40,
    cycle: 20
};

// API: Create Razorpay Order
app.post('/api/payments/create-order', authMiddleware, async (req, res) => {
    try {
        const { vehicleId } = req.body;
        if (!vehicleId) {
            return res.status(400).json({ success: false, message: 'Vehicle ID is required' });
        }

        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle || vehicle.isAvailable === false) {
            return res.status(404).json({ success: false, message: 'Vehicle not found' });
        }

        const user = await User.findById(req.userId);
        if (!user) return res.status(401).json({ success: false, message: 'Login session expire ho gaya.' });
        if (!vehicle.owner) return res.status(409).json({ success: false, message: 'Ye purani/demo listing hai. Owner account se dobara list karni hogi.' });
        if (vehicle.owner && vehicle.owner.toString() === req.userId.toString()) {
            return res.status(403).json({ success: false, message: 'Apne hi vehicle ka contact unlock nahi kar sakte.' });
        }
        if (user.unlockedVehicles.some(id => id.toString() === vehicleId.toString())) {
            return res.json({
                success: true,
                alreadyUnlocked: true,
                message: 'Vehicle contact already unlocked!',
                ownerPhone: vehicle.ownerPhone,
                ownerLocation: vehicle.ownerLocation
            });
        }

        const amountInRupees = UNLOCK_PRICING[vehicle.category];
        if (!amountInRupees) return res.status(400).json({ success: false, message: 'Unknown vehicle category.' });
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_ID.includes('placeholder') || process.env.RAZORPAY_KEY_SECRET.includes('placeholder')) {
            return res.status(503).json({ success: false, message: 'Razorpay keys configured nahi hain. Test/live keys backend .env mein set karo.' });
        }
        const amountInPaise = amountInRupees * 100;

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `rc_rec_${Date.now().toString().slice(-8)}`,
            notes: {
                vehicleId: vehicle._id.toString(),
                userId: req.userId.toString(),
                vehicleTitle: vehicle.title
            }
        };

        const order = await razorpay.orders.create(options);

        const paymentRecord = new Payment({
            razorpayOrderId: order.id,
            amount: amountInRupees,
            user: req.userId,
            vehicle: vehicle._id,
            status: 'created'
        });
        await paymentRecord.save();

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            vehicleTitle: vehicle.title,
            userName: user.name,
            userEmail: user.email,
            userPhone: user.phone
        });
    } catch (err) {
        console.error('Create Razorpay Order Error:', err);
        const detail = err.error?.description || err.message || 'Unknown Razorpay error';
        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'production'
                ? 'Payment gateway error while creating order.'
                : `Razorpay order error: ${detail}`
        });
    }
});

// API: Verify Razorpay Payment Signature
app.post('/api/payments/verify', authMiddleware, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, vehicleId } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !vehicleId) {
            return res.status(400).json({ success: false, message: 'Invalid payment confirmation data.' });
        }
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, user: req.userId, vehicle: vehicleId, status: 'created' });
        const vehicle = await Vehicle.findById(vehicleId);
        if (!payment || !vehicle || vehicle.isAvailable === false) {
            return res.status(409).json({ success: false, message: 'Payment order ya vehicle ab available nahi hai.' });
        }
        const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
        const expected = Buffer.from(generatedSignature, 'hex');
        const received = Buffer.from(razorpay_signature, 'hex');
        if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
            await Payment.findByIdAndUpdate(payment._id, { status: 'failed' });
            return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
        }
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpaySignature = razorpay_signature;
        payment.status = 'paid';
        await payment.save();
        await User.findByIdAndUpdate(req.userId, { $addToSet: { unlockedVehicles: vehicleId } });
        await Vehicle.updateOne({ _id: vehicleId, availabilityCheckDueAt: null }, { $set: { availabilityCheckDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        res.json({ success: true, message: 'Payment verified. Owner contact unlocked.', ownerPhone: vehicle.ownerPhone, ownerLocation: vehicle.ownerLocation });
    } catch (err) {
        console.error('Verify Payment Error:', err);
        res.status(500).json({ success: false, message: 'Payment verification failed on server.' });
    }
});

// Owner confirms availability after a customer has unlocked contact for 24 hours.
app.get('/api/owner/availability-checks', authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const vehicles = await Vehicle.find({ owner: req.userId, isAvailable: true, availabilityCheckDueAt: { $ne: null, $lte: now } })
            .select('title category price');
        res.json({ success: true, vehicles: vehicles.map(v => ({ id: v._id, title: v.title, category: v.category, price: v.price })) });
    } catch (err) {
        console.error('Availability check fetch error:', err);
        res.status(500).json({ success: false, message: 'Owner availability check load nahi ho saka.' });
    }
});

app.post('/api/owner/availability-checks/:vehicleId', authMiddleware, async (req, res) => {
    try {
        const { rented } = req.body;
        if (typeof rented !== 'boolean') return res.status(400).json({ success: false, message: 'rented true/false hona chahiye.' });
        const update = rented
            ? { isAvailable: false, availabilityCheckDueAt: null, rentConfirmedAt: new Date() }
            : { availabilityCheckDueAt: null };
        const vehicle = await Vehicle.findOneAndUpdate({ _id: req.params.vehicleId, owner: req.userId, isAvailable: true }, { $set: update }, { new: true });
        if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle nahi mila ya aap iske owner nahi hain.' });
        res.json({ success: true, message: rented ? 'Vehicle listing public se hata di gayi.' : 'Listing available rahegi.' });
    } catch (err) {
        console.error('Availability confirmation error:', err);
        res.status(500).json({ success: false, message: 'Availability update nahi ho saka.' });
    }
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Rent Connect India is running.' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server chal gaya: http://127.0.0.1:${PORT}`);
});
