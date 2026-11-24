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
    verificationStatus: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
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
    unavailablePeriods: [{ startDate: { type: Date, required: true }, endDate: { type: Date, required: true } }],
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

const bookingSchema = new mongoose.Schema({
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    renter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalPrice: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'declined', 'cancelled'], default: 'pending', index: true },
    reviewSubmitted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', bookingSchema);

const reviewSchema = new mongoose.Schema({
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    renter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
    createdAt: { type: Date, default: Date.now }
});
const Review = mongoose.model('Review', reviewSchema);
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

        const reviewSummaries = await Review.aggregate([
            { $group: { _id: '$vehicle', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } }
        ]);
        const reviewsByVehicle = new Map(reviewSummaries.map(item => [item._id.toString(), item]));
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
                ownerLocation: v.ownerLocation,
                ownerPhone: (isUnlocked || isOwner) ? v.ownerPhone : null,
                isUnlocked: isUnlocked || isOwner,
                isOwner,
                ownerVerified: v.owner?.verificationStatus === 'verified',
                averageRating: reviewsByVehicle.get(v._id.toString())?.averageRating || 0,
                reviewCount: reviewsByVehicle.get(v._id.toString())?.reviewCount || 0
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
        if (!listingUser) {
            return res.status(401).json({ success: false, message: 'Account nahi mila. Dobara login karo.' });
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

// Booking requests are date-based. Monthly rates are prorated over 30 days.
function parseBookingDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
    return date;
}

function serializeBooking(booking, side) {
    const vehicle = booking.vehicle && typeof booking.vehicle === 'object' ? booking.vehicle : null;
    const owner = booking.owner && typeof booking.owner === 'object' ? booking.owner : null;
    const renter = booking.renter && typeof booking.renter === 'object' ? booking.renter : null;
    return {
        id: booking._id,
        status: booking.status,
        startDate: booking.startDate.toISOString().slice(0, 10),
        endDate: booking.endDate.toISOString().slice(0, 10),
        totalPrice: booking.totalPrice,
        createdAt: booking.createdAt,
        vehicle: vehicle ? {
            id: vehicle._id,
            title: vehicle.title,
            category: vehicle.category,
            price: vehicle.price,
            city: vehicle.ownerLocation,
            image: vehicle.img
        } : null,
        owner: side === 'renter' && owner ? { name: owner.name } : undefined,
        renter: side === 'owner' && renter ? { name: renter.name, email: renter.email, phone: renter.phone } : undefined
    };
}

function periodsOverlap(startDate, endDate, period) {
    return period.startDate <= endDate && period.endDate >= startDate;
}

app.get('/api/vehicles/:vehicleId/availability', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.vehicleId)) return res.status(400).json({ success: false, message: 'Vehicle ID invalid hai.' });
        const from = parseBookingDate(req.query.from);
        const to = parseBookingDate(req.query.to);
        if (!from || !to || to < from || (to - from) / 86400000 > 100) {
            return res.status(400).json({ success: false, message: 'Valid date range chuno (maximum 100 days).' });
        }
        const vehicle = await Vehicle.findById(req.params.vehicleId).select('unavailablePeriods isAvailable');
        if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle nahi mila.' });
        const bookings = await Booking.find({
            vehicle: vehicle._id,
            status: { $in: ['pending', 'confirmed'] },
            startDate: { $lte: to }, endDate: { $gte: from }
        }).select('startDate endDate status').lean();
        const blocked = (vehicle.unavailablePeriods || []).filter(period => periodsOverlap(from, to, period));
        res.json({
            success: true,
            unavailable: [
                ...blocked.map(period => ({ startDate: period.startDate.toISOString().slice(0, 10), endDate: period.endDate.toISOString().slice(0, 10), reason: 'owner-blocked' })),
                ...bookings.map(booking => ({ startDate: booking.startDate.toISOString().slice(0, 10), endDate: booking.endDate.toISOString().slice(0, 10), reason: booking.status }))
            ],
            isAvailable: vehicle.isAvailable !== false
        });
    } catch (err) {
        console.error('Availability calendar error:', err);
        res.status(500).json({ success: false, message: 'Availability calendar load nahi ho saka.' });
    }
});

app.post('/api/vehicles/:vehicleId/availability', authMiddleware, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.vehicleId)) return res.status(400).json({ success: false, message: 'Vehicle ID invalid hai.' });
        const startDate = parseBookingDate(req.body.startDate);
        const endDate = parseBookingDate(req.body.endDate);
        const action = req.body.action;
        if (!startDate || !endDate || endDate < startDate || !['block', 'open'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Valid dates aur block/open action chuno.' });
        }
        const vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, owner: req.userId });
        if (!vehicle) return res.status(404).json({ success: false, message: 'Sirf apni listing ka calendar manage kar sakte hain.' });
        if (action === 'block') {
            const conflict = await Booking.exists({
                vehicle: vehicle._id, status: { $in: ['pending', 'confirmed'] },
                startDate: { $lte: endDate }, endDate: { $gte: startDate }
            });
            if (conflict) return res.status(409).json({ success: false, message: 'In dates par booking request/confirmation hai; pehle usse manage karo.' });
            vehicle.unavailablePeriods.push({ startDate, endDate });
        } else {
            const updated = [];
            for (const period of vehicle.unavailablePeriods || []) {
                if (!periodsOverlap(startDate, endDate, period)) { updated.push(period); continue; }
                if (period.startDate < startDate) {
                    updated.push({ startDate: period.startDate, endDate: new Date(startDate.getTime() - 86400000) });
                }
                if (period.endDate > endDate) {
                    updated.push({ startDate: new Date(endDate.getTime() + 86400000), endDate: period.endDate });
                }
            }
            vehicle.unavailablePeriods = updated;
        }
        await vehicle.save();
        res.json({ success: true, message: action === 'block' ? 'Dates unavailable mark ho gayi.' : 'Dates ab available hain.' });
    } catch (err) {
        console.error('Update availability error:', err);
        res.status(500).json({ success: false, message: 'Availability update nahi ho saka.' });
    }
});

app.get('/api/verification/status', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('verificationStatus');
        if (!user) return res.status(404).json({ success: false, message: 'Account nahi mila.' });
        res.json({ success: true, status: user.verificationStatus || 'unverified' });
    } catch (err) {
        console.error('Verification status error:', err);
        res.status(500).json({ success: false, message: 'Verification status load nahi hua.' });
    }
});

app.post('/api/verification/request', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: 'Account nahi mila.' });
        if (!(await Vehicle.exists({ owner: user._id }))) return res.status(400).json({ success: false, message: 'Verified badge request se pehle kam se kam ek vehicle list karo.' });
        if (user.verificationStatus === 'verified') return res.json({ success: true, status: 'verified', message: 'Aap pehle se verified hain.' });
        user.verificationStatus = 'pending';
        await user.save();
        res.json({ success: true, status: 'pending', message: 'Verification request bhej di. Badge review ke baad dikhega.' });
    } catch (err) {
        console.error('Verification request error:', err);
        res.status(500).json({ success: false, message: 'Verification request bheji nahi ja saki.' });
    }
});

app.get('/api/vehicles/:vehicleId/reviews', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.vehicleId)) return res.status(400).json({ success: false, message: 'Vehicle ID invalid hai.' });
        const reviews = await Review.find({ vehicle: req.params.vehicleId }).sort({ createdAt: -1 })
            .populate('renter', 'name').limit(20).lean();
        res.json({ success: true, reviews: reviews.map(review => ({ rating: review.rating, comment: review.comment, renterName: review.renter?.name || 'Renter', createdAt: review.createdAt })) });
    } catch (err) {
        console.error('Vehicle reviews error:', err);
        res.status(500).json({ success: false, message: 'Reviews load nahi ho sake.' });
    }
});

app.post('/api/bookings/:bookingId/review', authMiddleware, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.bookingId)) return res.status(400).json({ success: false, message: 'Booking ID invalid hai.' });
        const rating = Number(req.body.rating);
        const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
        if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 1000) {
            return res.status(400).json({ success: false, message: '1 se 5 stars aur 1000 characters tak review likho.' });
        }
        const booking = await Booking.findOne({ _id: req.params.bookingId, renter: req.userId });
        if (!booking) return res.status(404).json({ success: false, message: 'Aapki booking nahi mili.' });
        const todayValue = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const today = parseBookingDate(todayValue);
        if (booking.status !== 'confirmed' || booking.endDate >= today) {
            return res.status(409).json({ success: false, message: 'Review completed, confirmed rental ke baad hi de sakte hain.' });
        }
        if (booking.reviewSubmitted) return res.status(409).json({ success: false, message: 'Is booking par review pehle submit ho chuka hai.' });
        await Review.create({ vehicle: booking.vehicle, booking: booking._id, renter: booking.renter, owner: booking.owner, rating, comment });
        booking.reviewSubmitted = true;
        await booking.save();
        res.status(201).json({ success: true, message: 'Review submit ho gaya. Shukriya!' });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: 'Is booking par review pehle submit ho chuka hai.' });
        console.error('Submit review error:', err);
        res.status(500).json({ success: false, message: 'Review submit nahi ho saka.' });
    }
});

/* Owner verification approval is controlled by a server-side secret. Keep it in
   Render environment variables; never include it in frontend code. */
app.get('/api/admin/verification', authMiddleware, async (req, res) => {
    try {
        const adminKey = process.env.VERIFICATION_ADMIN_KEY;
        if (!adminKey || req.get('x-verification-admin-key') !== adminKey) return res.status(403).json({ success: false, message: 'Verification admin access nahi hai.' });
        const users = await User.find({ verificationStatus: 'pending' }).select('name email verificationStatus createdAt').lean();
        res.json({ success: true, requests: users });
    } catch (err) {
        console.error('Verification request list error:', err);
        res.status(500).json({ success: false, message: 'Verification requests load nahi ho sake.' });
    }
});

app.post('/api/admin/verification/:userId', authMiddleware, async (req, res) => {
    try {
        const adminKey = process.env.VERIFICATION_ADMIN_KEY;
        if (!adminKey || req.get('x-verification-admin-key') !== adminKey) {
            return res.status(403).json({ success: false, message: 'Verification admin access nahi hai.' });
        }
        const status = req.body.status;
        if (!['verified', 'rejected'].includes(status) || !mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({ success: false, message: 'Valid user ID aur verified/rejected status required.' });
        }
        const user = await User.findByIdAndUpdate(req.params.userId, { verificationStatus: status }, { new: true }).select('name email verificationStatus');
        if (!user) return res.status(404).json({ success: false, message: 'User nahi mila.' });
        res.json({ success: true, user });
    } catch (err) {
        console.error('Verification admin update error:', err);
        res.status(500).json({ success: false, message: 'Verification update nahi ho saka.' });
    }
});

app.post('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const { vehicleId, startDate: startDateValue, endDate: endDateValue } = req.body;
        if (!mongoose.isValidObjectId(vehicleId)) {
            return res.status(400).json({ success: false, message: 'Vehicle select karo.' });
        }

        const startDate = parseBookingDate(startDateValue);
        const endDate = parseBookingDate(endDateValue);
        const todayValue = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date());
        const today = parseBookingDate(todayValue);
        if (!startDate || !endDate || startDate < today || endDate < startDate) {
            return res.status(400).json({ success: false, message: 'Aaj ya uske baad ki valid start aur end dates chuno.' });
        }

        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle || vehicle.isAvailable === false || !vehicle.owner) {
            return res.status(404).json({ success: false, message: 'Ye vehicle ab booking ke liye available nahi hai.' });
        }
        if (vehicle.owner.toString() === req.userId.toString()) {
            return res.status(400).json({ success: false, message: 'Apni listing par booking request nahi bhej sakte.' });
        }

        const ownerBlocked = (vehicle.unavailablePeriods || []).some(period => periodsOverlap(startDate, endDate, period));
        if (ownerBlocked) return res.status(409).json({ success: false, message: 'Owner ne in dates ko unavailable mark kiya hai.' });

        const overlap = await Booking.exists({
            vehicle: vehicle._id,
            status: { $in: ['pending', 'confirmed'] },
            startDate: { $lte: endDate },
            endDate: { $gte: startDate }
        });
        if (overlap) {
            return res.status(409).json({ success: false, message: 'In dates ke liye pehle se request/booking maujood hai. Doosri dates chuno.' });
        }

        const renter = await User.findById(req.userId).select('_id');
        if (!renter) return res.status(401).json({ success: false, message: 'Dobara login karo.' });
        const days = Math.floor((endDate - startDate) / 86400000) + 1;
        const totalPrice = Math.ceil((vehicle.price * days) / 30);
        const booking = await Booking.create({
            vehicle: vehicle._id,
            renter: renter._id,
            owner: vehicle.owner,
            startDate,
            endDate,
            totalPrice,
            status: 'pending'
        });

        res.status(201).json({
            success: true,
            message: 'Booking request owner ko bhej di gayi.',
            booking: serializeBooking({ ...booking.toObject(), vehicle }, 'renter')
        });
    } catch (err) {
        console.error('Create booking request error:', err);
        res.status(500).json({ success: false, message: 'Booking request bheji nahi ja saki.' });
    }
});

app.get('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const [asRenter, forMyVehicles] = await Promise.all([
            Booking.find({ renter: req.userId }).sort({ createdAt: -1 })
                .populate('vehicle', 'title category price ownerLocation img')
                .populate('owner', 'name')
                .lean(),
            Booking.find({ owner: req.userId }).sort({ createdAt: -1 })
                .populate('vehicle', 'title category price ownerLocation img')
                .populate('renter', 'name email phone')
                .lean()
        ]);
        const reviewedBookings = await Review.find({ booking: { $in: asRenter.map(booking => booking._id) } }).select('booking').lean();
        const reviewedIds = new Set(reviewedBookings.map(review => review.booking.toString()));
        res.json({
            success: true,
            asRenter: asRenter.map(booking => ({ ...serializeBooking(booking, 'renter'), reviewSubmitted: reviewedIds.has(booking._id.toString()) })),
            forMyVehicles: forMyVehicles.map(booking => serializeBooking(booking, 'owner'))
        });
    } catch (err) {
        console.error('Load bookings error:', err);
        res.status(500).json({ success: false, message: 'Bookings load nahi ho sake.' });
    }
});

app.post('/api/bookings/:bookingId/respond', authMiddleware, async (req, res) => {
    try {
        const { action } = req.body;
        if (!['accept', 'decline', 'cancel'].includes(action) || !mongoose.isValidObjectId(req.params.bookingId)) {
            return res.status(400).json({ success: false, message: 'Invalid booking action.' });
        }
        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ success: false, message: 'Booking request nahi mili.' });

        const isOwner = booking.owner.toString() === req.userId.toString();
        const isRenter = booking.renter.toString() === req.userId.toString();
        if (action === 'cancel') {
            if (!isOwner && !isRenter) return res.status(403).json({ success: false, message: 'Is booking ko manage karne ki permission nahi hai.' });
            if (!['pending', 'confirmed'].includes(booking.status)) {
                return res.status(409).json({ success: false, message: 'Ye booking ab cancel nahi ho sakti.' });
            }
            booking.status = 'cancelled';
        } else {
            if (!isOwner) return res.status(403).json({ success: false, message: 'Sirf listing owner request ka jawab de sakta hai.' });
            if (booking.status !== 'pending') return res.status(409).json({ success: false, message: 'Is request ka pehle hi jawab diya ja chuka hai.' });

            if (action === 'accept') {
                const vehicle = await Vehicle.findById(booking.vehicle).select('unavailablePeriods');
                const blocked = (vehicle?.unavailablePeriods || []).some(period => periodsOverlap(booking.startDate, booking.endDate, period));
                if (blocked) return res.status(409).json({ success: false, message: 'Owner ne in dates ko unavailable mark kiya hai.' });
                const conflict = await Booking.exists({
                    _id: { $ne: booking._id },
                    vehicle: booking.vehicle,
                    status: 'confirmed',
                    startDate: { $lte: booking.endDate },
                    endDate: { $gte: booking.startDate }
                });
                if (conflict) return res.status(409).json({ success: false, message: 'In dates par doosri confirmed booking hai.' });
                booking.status = 'confirmed';
            } else {
                booking.status = 'declined';
            }
        }

        await booking.save();
        if (action === 'accept') {
            await Booking.updateMany({
                _id: { $ne: booking._id },
                vehicle: booking.vehicle,
                status: 'pending',
                startDate: { $lte: booking.endDate },
                endDate: { $gte: booking.startDate }
            }, { $set: { status: 'declined' } });
        }
        res.json({ success: true, message: action === 'accept' ? 'Booking confirm ho gayi.' : action === 'decline' ? 'Request decline kar di.' : 'Booking cancel kar di.' });
    } catch (err) {
        console.error('Respond to booking error:', err);
        res.status(500).json({ success: false, message: 'Booking update nahi ho saki.' });
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
