// In-memory OTP storage (use Redis in production)
const fs = require('fs');
const path = require('path');

const otpDataFile = path.join(__dirname, '../otpStorage.json');

// Load OTP data from file
const loadOTPData = () => {
    console.log('Loading OTP data from file');
    try {
        if (fs.existsSync(otpDataFile)) {
            console.log('OTP file exists');
            const data = fs.readFileSync(otpDataFile, 'utf8');
            const parsed = JSON.parse(data);
            console.log('Parsed data:', parsed);
            // Convert back to Map
            const map = new Map();
            for (const [key, value] of Object.entries(parsed)) {
                map.set(key, value);
            }
            console.log('Loaded OTP storage keys:', Array.from(map.keys()));
            return map;
        } else {
            console.log('OTP file does not exist');
        }
    } catch (error) {
        console.error('Error loading OTP data:', error);
    }
    return new Map();
};

// Save OTP data to file
const saveOTPData = (data) => {
    console.log('Saving OTP data to file');
    try {
        const obj = Object.fromEntries(data);
        console.log('Data to save:', obj);
        fs.writeFileSync(otpDataFile, JSON.stringify(obj, null, 2));
        console.log('OTP data saved successfully');
    } catch (error) {
        console.error('Error saving OTP data:', error);
    }
};

// Initialize OTP storage
let otpStorage = loadOTPData();

// Store OTP with expiration (10 minutes)
const storeOTP = (email, otp) => {
    const expirationTime = Date.now() + (10 * 60 * 1000); // 10 minutes
    console.log('Storing OTP for email:', email, 'OTP:', otp, 'Expires at:', new Date(expirationTime));
    otpStorage.set(email, {
        otp,
        expiresAt: expirationTime
    });
    saveOTPData(otpStorage);
    console.log('OTP stored successfully. Current storage:', Array.from(otpStorage.keys()));
};

// Verify OTP
const verifyOTP = (email, otp) => {
    console.log('Verifying OTP for email:', email, 'OTP:', otp);
    console.log('Current storage keys:', Array.from(otpStorage.keys()));
    const storedData = otpStorage.get(email);

    if (!storedData) {
        console.log('No stored data found for email:', email);
        return false;
    }

    console.log('Stored data:', storedData);
    console.log('Current time:', Date.now(), 'Expires at:', storedData.expiresAt);

    // Check if expired
    if (Date.now() > storedData.expiresAt) {
        console.log('OTP expired for email:', email);
        otpStorage.delete(email);
        saveOTPData(otpStorage);
        return false;
    }

    // Check if OTP matches
    if (storedData.otp === otp) {
        console.log('OTP verified successfully for email:', email);
        otpStorage.delete(email);
        saveOTPData(otpStorage);
        return true;
    }

    console.log('OTP does not match. Stored:', storedData.otp, 'Provided:', otp);
    return false;
};

// Clean up expired OTPs (run periodically)
const cleanupExpiredOTPs = () => {
    const now = Date.now();
    let changed = false;
    for (const [email, data] of otpStorage.entries()) {
        if (now > data.expiresAt) {
            otpStorage.delete(email);
            changed = true;
        }
    }
    if (changed) {
        saveOTPData(otpStorage);
    }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

module.exports = {
    storeOTP,
    verifyOTP
};