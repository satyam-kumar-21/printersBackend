const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { generateOTP, sendOTPEmail } = require('../utils/emailService');
const { storeOTP, verifyOTP } = require('../utils/otpService');
const fs = require('fs');
const path = require('path');

const tempDataFile = path.join(__dirname, '../tempRegistrationData.json');

// Load temp registration data from file
const loadTempData = () => {
    try {
        if (fs.existsSync(tempDataFile)) {
            const data = fs.readFileSync(tempDataFile, 'utf8');
            const parsed = JSON.parse(data);
            // Convert back to Map
            const map = new Map();
            for (const [key, value] of Object.entries(parsed)) {
                map.set(key, value);
            }
            return map;
        }
    } catch (error) {
        console.error('Error loading temp data:', error);
    }
    return new Map();
};

// Save temp registration data to file
const saveTempData = (data) => {
    try {
        const obj = Object.fromEntries(data);
        fs.writeFileSync(tempDataFile, JSON.stringify(obj, null, 2));
    } catch (error) {
        console.error('Error saving temp data:', error);
    }
};

// Initialize temp data
let tempRegistrationData = loadTempData();

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
    const { email, password, isAdminLogin } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        // Check if user is blocked
        if (user.isBlocked) {
            res.status(403);
            throw new Error('Your account has been blocked by admin. Please contact support.');
        }

        // Strict Role Separation
        if (!isAdminLogin && user.isAdmin) {
            res.status(401);
            throw new Error('You are not our user');
        }

        if (isAdminLogin && !user.isAdmin) {
            res.status(401);
            throw new Error('Not authorized as an admin');
        }

        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// @desc    Send OTP for registration
// @route   POST /api/auth/send-registration-otp
// @access  Public
const sendRegistrationOTP = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    const trimmedEmail = email.trim().toLowerCase();

    console.log('Send registration OTP request:', { firstName, lastName, email: trimmedEmail });

    // Validate input
    if (!firstName || !lastName || !email || !password) {
        console.log('Validation failed: missing fields');
        res.status(400);
        throw new Error('All fields are required');
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: trimmedEmail });
    if (userExists) {
        console.log('User already exists:', trimmedEmail);
        res.status(400);
        throw new Error('User already exists');
    }

    // Generate and send OTP
    const otp = generateOTP();
    console.log('Generated OTP for registration:', otp);

    await sendOTPEmail(trimmedEmail, otp, 'registration');

    // Store OTP temporarily (in production, store user data too)
    storeOTP(trimmedEmail, otp);

    // Store registration data temporarily (in production, use Redis or temp storage)
    tempRegistrationData.set(trimmedEmail, {
        firstName,
        lastName,
        password,
        expiresAt: Date.now() + (10 * 60 * 1000) // 10 minutes
    });
    saveTempData(tempRegistrationData);
    console.log('Registration data stored for email:', trimmedEmail);

    console.log('Registration OTP sent successfully to:', trimmedEmail);
    res.json({ message: 'OTP sent to your email' });
});

// @desc    Verify OTP and register user
// @route   POST /api/auth/verify-registration-otp
// @access  Public
const verifyRegistrationOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    const trimmedEmail = email.trim().toLowerCase();
    console.log('Verify registration OTP request:', { email: trimmedEmail, otp });

    // Verify OTP
    const isValidOTP = verifyOTP(trimmedEmail, otp);
    console.log('OTP verification result:', isValidOTP);
    if (!isValidOTP) {
        console.log('OTP invalid or expired');
        res.status(400);
        throw new Error('Invalid or expired OTP');
    }

    // Get registration data
    const registrationData = tempRegistrationData.get(trimmedEmail);
    console.log('Registration data found:', !!registrationData);
    if (registrationData) {
        console.log('Registration data expires at:', new Date(registrationData.expiresAt));
    }
    if (!registrationData || Date.now() > registrationData.expiresAt) {
        console.log('Registration data expired or not found');
        res.status(400);
        throw new Error('Registration data expired');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
        res.status(400);
        throw new Error('User already exists with this email');
    }

    try {
        // Create user
        const user = await User.create({
            firstName: registrationData.firstName,
            lastName: registrationData.lastName,
            name: `${registrationData.firstName} ${registrationData.lastName}`,
            email: trimmedEmail,
            password: registrationData.password,
        });

        console.log('User created successfully:', user.email);

        // Clean up temp data
        tempRegistrationData.delete(trimmedEmail);
        saveTempData(tempRegistrationData);

        if (user) {
            res.status(201).json({
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
                token: generateToken(user._id),
            });
        } else {
            res.status(400);
            throw new Error('Invalid user data');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500);
        throw new Error('Failed to create user: ' + error.message);
    }
});

// @desc    Send OTP for password reset
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const trimmedEmail = email.trim().toLowerCase();

    console.log('Forgot password request for:', trimmedEmail);

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
        console.log('User not found:', trimmedEmail);
        res.status(404);
        throw new Error('User not found');
    }

    // Generate and send OTP
    const otp = generateOTP();
    console.log('Generated OTP for password reset:', otp);

    await sendOTPEmail(trimmedEmail, otp, 'password-reset');

    // Store OTP
    storeOTP(`${trimmedEmail}-reset`, otp);

    console.log('Password reset OTP sent successfully to:', trimmedEmail);
    res.json({ message: 'Password reset OTP sent to your email' });
});

// @desc    Verify OTP and reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;

    const trimmedEmail = email.trim().toLowerCase();

    // Verify OTP
    const isValidOTP = verifyOTP(`${trimmedEmail}-reset`, otp);
    if (!isValidOTP) {
        res.status(400);
        throw new Error('Invalid or expired OTP');
    }

    // Update password
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        user.firstName = req.body.firstName || user.firstName;
        user.lastName = req.body.lastName || user.lastName;
        user.name = `${user.firstName} ${user.lastName}`;
        user.email = req.body.email || user.email;

        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            name: updatedUser.name,
            email: updatedUser.email,
            isAdmin: updatedUser.isAdmin,
            token: generateToken(updatedUser._id),
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password');
    res.json(users);
});

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            if (user.isAdmin) {
                return res.status(400).json({ message: 'Cannot delete admin user' });
            }
            await user.deleteOne();
            res.json({ message: 'User removed' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Delete user error:', error);
        next(error);
    }
};

// @desc    Block user
// @route   PUT /api/auth/users/:id/block
// @access  Private/Admin
const blockUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            if (user.isAdmin) {
                return res.status(400).json({ message: 'Cannot block admin user' });
            }
            user.isBlocked = true;
            await user.save();
            res.json({ message: 'User blocked successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Block user error:', error);
        next(error);
    }
};

// @desc    Unblock user
// @route   PUT /api/auth/users/:id/unblock
// @access  Private/Admin
const unblockUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.isBlocked = false;
            await user.save();
            res.json({ message: 'User unblocked successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Unblock user error:', error);
        next(error);
    }
};

module.exports = {
    authUser,
    sendRegistrationOTP,
    verifyRegistrationOTP,
    forgotPassword,
    resetPassword,
    getUserProfile,
    updateUserProfile,
    getUsers,
    deleteUser,
    blockUser,
    unblockUser
};
